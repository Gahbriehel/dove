import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isGivingAccountNumber', async: false })
export class IsGivingAccountNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const stripped = value.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(stripped)) {
      return false;
    }
    if (stripped.length < 6 || stripped.length > 34) {
      return false;
    }

    const obj = args.object as { currency?: string };
    const currency = obj?.currency || 'NGN';
    if (currency === 'NGN' && stripped.length !== 10) {
      return false;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as { currency?: string };
    const currency = obj?.currency || 'NGN';
    if (currency === 'NGN') {
      return 'NGN account number must be exactly 10 digits';
    }
    return 'Account number must contain between 6 and 34 digits';
  }
}

export function IsGivingAccountNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsGivingAccountNumberConstraint,
    });
  };
}
