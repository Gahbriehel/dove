/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { EMAIL_SERVICE } from '../src/email/interfaces/email-service.interface';
import { ConsoleEmailProvider } from '../src/email/providers/console-email.provider';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 1 Acceptance Journey (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Test state across journey
  let adminAccessToken: string;
  let eventId: string;
  let teamRedId: string;
  let teamBlueId: string;
  let attendee1Token: string;
  let attendee1TeamId: string;
  let gameId: string;

  const testTimestamp = Date.now();
  const testEventTitle = `Acceptance Youth Conference ${testTimestamp}`;
  const attendee1Email = `caleb.${testTimestamp}@testdove.org`;
  const attendee1Phone = `+1${testTimestamp.toString().slice(-10)}`;
  const attendee2Email = `deborah.${testTimestamp}@testdove.org`;
  const attendee2Phone = `+2${testTimestamp.toString().slice(-10)}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_SERVICE)
      .useValue(new ConsoleEmailProvider())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (eventId) {
      await prisma.score
        .deleteMany({ where: { game: { eventId } } })
        .catch(() => {});
      await prisma.game.deleteMany({ where: { eventId } }).catch(() => {});
      await prisma.attendance
        .deleteMany({
          where: { registration: { eventId } },
        })
        .catch(() => {});
      await prisma.registration
        .deleteMany({ where: { eventId } })
        .catch(() => {});
      await prisma.team.deleteMany({ where: { eventId } }).catch(() => {});
      await prisma.event.delete({ where: { id: eventId } }).catch(() => {});
    }
    await prisma.person
      .deleteMany({
        where: {
          email: { in: [attendee1Email, attendee2Email] },
        },
      })
      .catch(() => {});

    await app.close();
  });

  describe('1. Administrator Authentication', () => {
    it('should log in the Super Admin and return JWT tokens with user profile', async () => {
      const email = process.env.SUPER_ADMIN_EMAIL || 'babatise002@gmail.com';
      const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.roles).toContain('SUPER_ADMIN');

      adminAccessToken = res.body.data.tokens.accessToken;
      expect(adminAccessToken).toBeDefined();
    });
  });

  describe('2. Event Creation & "Published" Visibility Enforcement', () => {
    it('should create an event in DRAFT status', async () => {
      const startDate = new Date(Date.now() + 86400000).toISOString();
      const endDate = new Date(Date.now() + 172800000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          title: testEventTitle,
          description:
            'Annual youth summit for spiritual growth and fellowship',
          capacity: 50,
          startDate,
          endDate,
          status: 'DRAFT',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('DRAFT');
      eventId = res.body.data.id;
    });

    it('enforcement: unauthenticated public request to GET /events should NOT list the draft event', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events')
        .expect(200);

      expect(res.body.success).toBe(true);
      const items: Array<{ id: string }> = res.body.data.items;
      const found = items.some((item) => item.id === eventId);
      expect(found).toBe(false);
    });

    it('enforcement: unauthenticated public request to GET /events/:id should return 404 for draft event', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/events/${eventId}`)
        .expect(404);
    });

    it('enforcement: public registration on draft event should be rejected with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/events/${eventId}/register`)
        .send({
          firstName: 'Caleb',
          lastName: 'Joshua',
          email: attendee1Email,
          phone: attendee1Phone,
        })
        .expect(400);

      expect(res.body.message).toMatch(
        /Registration is only allowed for published events/i,
      );
    });

    it('should allow admin to publish the event via PATCH /events/:id', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');
    });

    it('should now allow public unauthenticated request to view published event in GET /events', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/events')
        .expect(200);

      expect(res.body.success).toBe(true);
      const items: Array<{ id: string }> = res.body.data.items;
      const found = items.some((item) => item.id === eventId);
      expect(found).toBe(true);
    });

    it('should allow public unauthenticated request to view published event details in GET /events/:id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/events/${eventId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(eventId);
      expect(res.body.data.title).toBe(testEventTitle);
      expect(res.body.data.status).toBe('PUBLISHED');
    });
  });

  describe('3. Team Creation', () => {
    it('should create Team Red for the event', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          eventId,
          name: 'Team Red',
          color: '#FF0000',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Team Red');
      teamRedId = res.body.data.id;
    });

    it('should create Team Blue for the event', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          eventId,
          name: 'Team Blue',
          color: '#0000FF',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Team Blue');
      teamBlueId = res.body.data.id;
    });
  });

  describe('4. Public Registration & Balanced Team Assignment', () => {
    it('should register Attendee 1, create Person record, assign team, and generate QR code', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/events/${eventId}/register`)
        .send({
          firstName: 'Caleb',
          lastName: 'Joshua',
          email: attendee1Email,
          phone: attendee1Phone,
          gender: 'MALE',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.registration).toBeDefined();
      expect(data.registration.registrationNumber).toBeDefined();
      expect(data.registration.status).toBe('CONFIRMED');
      expect(data.registration.token).toBeDefined();
      expect(data.registration.qrCodeDataUrl).toMatch(
        /^data:image\/png;base64,/,
      );
      expect(data.registration.team).toBeDefined();
      expect([teamRedId, teamBlueId]).toContain(data.registration.team.id);

      attendee1Token = data.registration.token;
      attendee1TeamId = data.registration.team.id;

      // Verify Person was created in the database
      const person = await prisma.person.findFirst({
        where: { email: attendee1Email },
      });
      expect(person).toBeDefined();
      expect(person?.firstName).toBe('Caleb');
      expect(person?.membershipStatus).toBe('VISITOR');
    });

    it('should register Attendee 2 with balanced team assignment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/events/${eventId}/register`)
        .send({
          firstName: 'Deborah',
          lastName: 'Barak',
          email: attendee2Email,
          phone: attendee2Phone,
          gender: 'FEMALE',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.registration.token).toBeDefined();
      expect(data.registration.team).toBeDefined();
      // Balanced assignment ensures Attendee 2 is placed in the other team
      expect(data.registration.team.id).not.toBe(attendee1TeamId);
    });

    it('should reject duplicate registration for Attendee 1 with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/events/${eventId}/register`)
        .send({
          firstName: 'Caleb',
          lastName: 'Joshua',
          email: attendee1Email,
          phone: attendee1Phone,
        })
        .expect(409);

      expect(res.body.message).toMatch(/already registered/i);
    });
  });

  describe('5. Public QR Code Retrieval', () => {
    it('should serve a PNG image at /qr/:token.png', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/qr/${attendee1Token}.png`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect(res.body).toBeInstanceOf(Buffer);
    });
  });

  describe('6. Attendance & QR Check-in', () => {
    it('should check in Attendee 1 using their QR token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/checkin')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ token: attendee1Token })
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.status).toBe('CHECKED_IN');
      expect(data.person.firstName).toBe('Caleb');
      expect(data.person.lastName).toBe('Joshua');
      expect(data.team).toBeDefined();
    });

    it('should reject duplicate check-in with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/checkin')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ token: attendee1Token })
        .expect(400);

      expect(res.body.message).toMatch(/already checked in/i);
    });
  });

  describe('7. Games Setup & Score Recording', () => {
    it('should create a game with maxScore limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/games')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          eventId,
          name: 'Bible Quiz',
          description: 'Scripture trivia tournament',
          maxScore: 100,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.maxScore).toBe(100);
      gameId = res.body.data.id;
    });

    it('should reject a score that exceeds maxScore', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/scores')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          gameId,
          teamId: teamRedId,
          points: 150, // exceeds maxScore of 100
        })
        .expect(400);
    });

    it('should record scores for Team Red (75 pts) and Team Blue (90 pts)', async () => {
      // Score for Team Red
      const redScoreRes = await request(app.getHttpServer())
        .post('/api/v1/scores')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          gameId,
          teamId: teamRedId,
          points: 75,
        })
        .expect(201);
      expect(redScoreRes.body.success).toBe(true);

      // Score for Team Blue
      const blueScoreRes = await request(app.getHttpServer())
        .post('/api/v1/scores')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          gameId,
          teamId: teamBlueId,
          points: 90,
        })
        .expect(201);
      expect(blueScoreRes.body.success).toBe(true);
    });
  });

  describe('8. Public Leaderboard & Winning Team Resolution', () => {
    it('should return leaderboard sorted descending by points with winner at rank 1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/leaderboard/${eventId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const leaderboard = res.body.data.leaderboard;
      expect(leaderboard).toHaveLength(2);

      // Team Blue has 90 pts (Rank 1), Team Red has 75 pts (Rank 2)
      expect(leaderboard[0].teamId).toBe(teamBlueId);
      expect(leaderboard[0].teamName).toBe('Team Blue');
      expect(leaderboard[0].totalScore).toBe(90);

      expect(leaderboard[1].teamId).toBe(teamRedId);
      expect(leaderboard[1].teamName).toBe('Team Red');
      expect(leaderboard[1].totalScore).toBe(75);
    });
  });

  describe('9. Participant Data & Leaderboard CSV Export', () => {
    it('should export registrations CSV for the event', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/registrations/export?eventId=${eventId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(
        /filename="registrations-/,
      );

      const csvContent = res.text;
      expect(csvContent).toContain('Registration Number');
      expect(csvContent).toContain('Caleb');
      expect(csvContent).toContain('Joshua');
      expect(csvContent).toContain('CHECKED_IN');
      expect(csvContent).toContain('Deborah');
      expect(csvContent).toContain('Barak');
    });

    it('should export leaderboard CSV for the event', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/leaderboard/${eventId}/export`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(
        /filename="leaderboard-/,
      );

      const csvContent = res.text;
      expect(csvContent).toContain('Team Blue');
      expect(csvContent).toContain('90');
      expect(csvContent).toContain('Team Red');
      expect(csvContent).toContain('75');
    });
  });
});
