import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GivingAccount, GivingCurrency, GivingPurpose } from '@prisma/client';
import { type ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGivingAccountDto } from './dto/create-giving-account.dto';
import { QueryGivingAccountDto } from './dto/query-giving-account.dto';
import { ReorderGivingAccountsDto } from './dto/reorder-giving-accounts.dto';
import { UpdateGivingAccountDto } from './dto/update-giving-account.dto';

export interface GivingAccountResponse {
  id: string;
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: GivingCurrency;
  note: string | null;
  purposes: GivingPurpose[];
  sortOrder: number;
  isActive: boolean;
}

@Injectable()
export class GivingAccountsService {
  private readonly logger = new Logger(GivingAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryGivingAccountDto,
    user?: ActiveUserData,
  ): Promise<GivingAccountResponse[]> {
    const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') ?? false;

    const targetChurchId =
      query.churchId ||
      user?.churchId ||
      (await this.prisma.getDefaultChurchId());

    const where: { churchId: string; isActive?: boolean } = {
      churchId: targetChurchId,
    };

    if (!isSuperAdmin) {
      where.isActive = true;
    }

    const accounts = await this.prisma.givingAccount.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    let filtered = accounts;
    if (query.purpose) {
      filtered = accounts.filter((account) => {
        const purposes = Array.isArray(account.purposes)
          ? (account.purposes as unknown as GivingPurpose[])
          : [];
        return purposes.includes(query.purpose as GivingPurpose);
      });
    }

    return filtered.map((account) => this.toResponseShape(account));
  }

  async create(
    dto: CreateGivingAccountDto,
    user: ActiveUserData,
  ): Promise<GivingAccountResponse> {
    const churchId = user.churchId || (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    const cleanedAccountNumber = dto.accountNumber.replace(/[\s-]/g, '');
    const currency = dto.currency || GivingCurrency.NGN;

    if (!/^\d+$/.test(cleanedAccountNumber)) {
      throw new BadRequestException('Account number must contain only digits');
    }
    if (currency === GivingCurrency.NGN && cleanedAccountNumber.length !== 10) {
      throw new BadRequestException(
        'NGN account number must be exactly 10 digits',
      );
    }
    if (cleanedAccountNumber.length < 6 || cleanedAccountNumber.length > 34) {
      throw new BadRequestException(
        'Account number must contain between 6 and 34 digits',
      );
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const lastAccount = await this.prisma.givingAccount.findFirst({
        where: { churchId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = lastAccount ? lastAccount.sortOrder + 1 : 0;
    }

    const note =
      dto.note !== undefined && dto.note !== null && dto.note.trim() === ''
        ? null
        : (dto.note?.trim() ?? null);

    const account = await this.prisma.givingAccount.create({
      data: {
        churchId,
        label: dto.label.trim(),
        bankName: dto.bankName.trim(),
        accountName: dto.accountName.trim(),
        accountNumber: cleanedAccountNumber,
        currency,
        note,
        purposes: dto.purposes,
        sortOrder,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        updatedById: user.sub,
      },
    });

    this.logger.log(
      `Giving account created: id=${account.id}, user=${user.sub}, church=${churchId}`,
    );

    return this.toResponseShape(account);
  }

  async update(
    id: string,
    dto: UpdateGivingAccountDto,
    user: ActiveUserData,
  ): Promise<GivingAccountResponse> {
    const churchId = user.churchId || (await this.prisma.getDefaultChurchId());

    const existing = await this.prisma.givingAccount.findUnique({
      where: { id },
    });

    if (!existing || existing.churchId !== churchId) {
      throw new NotFoundException(`Giving account with ID "${id}" not found`);
    }

    const targetCurrency = dto.currency || existing.currency;
    const targetAccountNumber = dto.accountNumber
      ? dto.accountNumber.replace(/[\s-]/g, '')
      : existing.accountNumber;

    if (!/^\d+$/.test(targetAccountNumber)) {
      throw new BadRequestException('Account number must contain only digits');
    }
    if (
      targetCurrency === GivingCurrency.NGN &&
      targetAccountNumber.length !== 10
    ) {
      throw new BadRequestException(
        'NGN account number must be exactly 10 digits',
      );
    }
    if (targetAccountNumber.length < 6 || targetAccountNumber.length > 34) {
      throw new BadRequestException(
        'Account number must contain between 6 and 34 digits',
      );
    }

    const note =
      dto.note !== undefined
        ? dto.note === null || dto.note.trim() === ''
          ? null
          : dto.note.trim()
        : undefined;

    const updated = await this.prisma.givingAccount.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label.trim() }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName.trim() }),
        ...(dto.accountName !== undefined && {
          accountName: dto.accountName.trim(),
        }),
        ...(dto.accountNumber !== undefined && {
          accountNumber: targetAccountNumber,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.note !== undefined && { note }),
        ...(dto.purposes !== undefined && { purposes: dto.purposes }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedById: user.sub,
      },
    });

    this.logger.log(
      `Giving account updated: id=${id}, user=${user.sub}, church=${churchId}, oldAccountNumber=${existing.accountNumber}, newAccountNumber=${updated.accountNumber}`,
    );

    return this.toResponseShape(updated);
  }

  async reorder(
    dto: ReorderGivingAccountsDto,
    user: ActiveUserData,
  ): Promise<{ message: string }> {
    const churchId = user.churchId || (await this.prisma.getDefaultChurchId());
    const { ids } = dto;

    const existingAccounts = await this.prisma.givingAccount.findMany({
      where: {
        id: { in: ids },
        churchId,
      },
      select: { id: true },
    });

    if (existingAccounts.length !== ids.length) {
      throw new BadRequestException(
        'One or more account IDs are invalid or belong to another church',
      );
    }

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.givingAccount.update({
          where: { id },
          data: {
            sortOrder: index,
            updatedById: user.sub,
          },
        }),
      ),
    );

    this.logger.log(
      `Giving accounts reordered: ids=[${ids.join(', ')}], user=${user.sub}, church=${churchId}`,
    );

    return { message: 'Giving accounts reordered successfully' };
  }

  async remove(id: string, user: ActiveUserData): Promise<{ message: string }> {
    const churchId = user.churchId || (await this.prisma.getDefaultChurchId());

    const existing = await this.prisma.givingAccount.findUnique({
      where: { id },
    });

    if (!existing || existing.churchId !== churchId) {
      throw new NotFoundException(`Giving account with ID "${id}" not found`);
    }

    await this.prisma.givingAccount.delete({
      where: { id },
    });

    this.logger.log(
      `Giving account deleted: id=${id}, user=${user.sub}, church=${churchId}`,
    );

    return { message: 'Giving account deleted successfully' };
  }

  private toResponseShape(account: GivingAccount): GivingAccountResponse {
    return {
      id: account.id,
      label: account.label,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      currency: account.currency,
      note: account.note,
      purposes: Array.isArray(account.purposes)
        ? (account.purposes as unknown as GivingPurpose[])
        : [],
      sortOrder: account.sortOrder,
      isActive: account.isActive,
    };
  }
}
