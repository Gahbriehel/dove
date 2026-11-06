/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfessionStatus, ConfessionVoice } from '@prisma/client';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { parseBuffer } from 'music-metadata';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ConfessionsService } from './confessions.service';
import { getBodyHash } from './utils/confession.util';

jest.mock('music-metadata', () => ({
  parseBuffer: jest.fn(),
}));

jest.mock('fs', () => {
  const original = jest.requireActual('fs');
  return {
    ...original,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    rmSync: jest.fn(),
  };
});

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

describe('Confessions Audio Management', () => {
  let service: ConfessionsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    confession: {
      findUnique: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
    };
    confessionAudio: {
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };

  const adminUser: ActiveUserData = {
    sub: 'admin-1',
    email: 'admin@church.org',
    roles: ['ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      confession: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      confessionAudio: {
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfessionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ConfessionsService>(ConfessionsService);
  });

  describe('uploadAudio', () => {
    it('rejects a non-MP3 file renamed to .mp3', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
        body: 'Body text',
        audio: [],
      });

      const fakeFile = {
        originalname: 'fake.mp3',
        mimetype: 'audio/mpeg',
        size: 1024,
        buffer: Buffer.from('not really an mp3'),
      } as Express.Multer.File;

      (parseBuffer as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to parse audio format'),
      );

      await expect(
        service.uploadAudio('c-1', 'female', fakeFile, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an audio file where parsed container is not MPEG', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
        body: 'Body text',
        audio: [],
      });

      const fakeWav = {
        originalname: 'fake.mp3',
        mimetype: 'audio/mpeg',
        size: 1024,
        buffer: Buffer.from('riff wave audio'),
      } as Express.Multer.File;

      (parseBuffer as jest.Mock).mockResolvedValueOnce({
        format: {
          container: 'WAV',
          codec: 'PCM',
          duration: 30,
        },
      });

      await expect(
        service.uploadAudio('c-1', 'female', fakeWav, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces audio: changes URL, upserts row, and removes old file from disk', async () => {
      const oldAudio = {
        id: 'a-old',
        confessionId: 'c-1',
        voice: ConfessionVoice.FEMALE,
        url: '/public/confession-audio/c-1/female-old11111.mp3',
        durationSec: 25,
        sizeBytes: 800,
        textHash: 'oldhash',
      };

      const confessionRecord = {
        id: 'c-1',
        churchId: 'church-1',
        title: 'Confession 1',
        slug: 'confession-1',
        body: 'Current body text',
        status: ConfessionStatus.PUBLISHED,
        sortOrder: 0,
        createdAt: new Date(),
        audio: [oldAudio],
      };

      // 1. Initial lookup in uploadAudio
      prismaMock.confession.findUnique.mockResolvedValueOnce(confessionRecord);

      const validMp3File = {
        originalname: 'new.mp3',
        mimetype: 'audio/mpeg',
        size: 2048,
        buffer: Buffer.from('valid mp3 audio stream content'),
      } as Express.Multer.File;

      (parseBuffer as jest.Mock).mockResolvedValueOnce({
        format: {
          container: 'MPEG',
          codec: 'MPEG 1 Layer 3',
          duration: 52.3,
        },
      });

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Return updated confession for findOne
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        ...confessionRecord,
        audio: [
          {
            ...oldAudio,
            url: expect.stringContaining(
              '/public/confession-audio/c-1/female-',
            ),
            durationSec: 52,
            sizeBytes: 2048,
          },
        ],
      });
      prismaMock.confession.findMany.mockResolvedValueOnce([]); // for published

      await service.uploadAudio('c-1', 'female', validMp3File, adminUser);

      // Verify new file was written
      expect(fsPromises.writeFile).toHaveBeenCalled();

      // Verify ConfessionAudio upserted with duration, size, textHash
      expect(prismaMock.confessionAudio.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            confessionId_voice: {
              confessionId: 'c-1',
              voice: ConfessionVoice.FEMALE,
            },
          },
          create: expect.objectContaining({
            durationSec: 52,
            sizeBytes: 2048,
            textHash: getBodyHash('Current body text'),
          }),
        }),
      );

      // Verify old audio file was unlinked
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('female-old11111.mp3'),
      );
    });
  });

  describe('delete confession and audio files', () => {
    it('deleting a confession removes its MP3 files on disk', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
      });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.remove('c-1', adminUser);

      expect(prismaMock.confession.delete).toHaveBeenCalledWith({
        where: { id: 'c-1' },
      });
      expect(fs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining('confession-audio/c-1'),
        { recursive: true, force: true },
      );
      expect(result).toEqual({ message: 'Confession deleted successfully' });
    });
  });

  describe('removeAudio', () => {
    it('removes audio file and deletes row; returns 404 if voice has no audio', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
        audio: [
          {
            id: 'a-female',
            voice: ConfessionVoice.FEMALE,
            url: '/public/confession-audio/c-1/female-123.mp3',
          },
        ],
      });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.removeAudio('c-1', 'female', adminUser);

      expect(prismaMock.confessionAudio.delete).toHaveBeenCalledWith({
        where: { id: 'a-female' },
      });
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('female-123.mp3'),
      );

      // 404 when voice has no audio
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
        audio: [],
      });
      await expect(
        service.removeAudio('c-1', 'female', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('audioStale detection', () => {
    it('audioStale flips to true after the body changes', async () => {
      const originalBody = 'This is the original confession text.';
      const updatedBody = 'This is the edited confession text with typo fix.';
      const originalHash = getBodyHash(originalBody);

      const confession = {
        id: 'c-1',
        slug: 'confession-1',
        title: 'Title',
        body: updatedBody, // body has changed!
        scriptureRef: null,
        category: null,
        status: ConfessionStatus.PUBLISHED,
        sortOrder: 0,
        churchId: 'church-1',
        audio: [
          {
            id: 'a-1',
            confessionId: 'c-1',
            voice: ConfessionVoice.FEMALE,
            url: '/public/confession-audio/c-1/female-123.mp3',
            durationSec: 30,
            sizeBytes: 1000,
            textHash: originalHash, // matches originalBody, not updatedBody
          },
          {
            id: 'a-2',
            confessionId: 'c-1',
            voice: ConfessionVoice.MALE,
            url: '/public/confession-audio/c-1/male-456.mp3',
            durationSec: 32,
            sizeBytes: 1050,
            textHash: getBodyHash(updatedBody), // matches updatedBody
          },
        ],
      };

      prismaMock.confession.findUnique.mockResolvedValueOnce(confession);
      prismaMock.confession.findMany.mockResolvedValueOnce([]);

      const result = await service.findOne(
        'confession-1',
        'church-1',
        adminUser,
      );

      expect(result.audioStale).toEqual({
        female: true, // stale!
        male: false, // up-to-date!
      });
    });
  });
});
