
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({
  name: 'fechaNoFutura',
  async: false,
})
export class FechaNoFuturaConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    // Verifica el formato YYYY-MM-DD.
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!coincidencia) {
      return false;
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);

    // Comprueba que el día exista realmente en ese mes.
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));

    if (
      fecha.getUTCFullYear() !== anio ||
      fecha.getUTCMonth() !== mes - 1 ||
      fecha.getUTCDate() !== dia
    ) {
      return false;
    }

    // Compara fechas sin depender de la hora ni de la zona horaria.
    const hoy = new Date();
    const hoyISO = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0'),
    ].join('-');

    return value <= hoyISO;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} debe ser una fecha válida y no puede ser futura.`;
  }
}

export function FechaNoFutura(
  options?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: String(propertyName),
      options,
      validator: FechaNoFuturaConstraint,
    });
  };
}
