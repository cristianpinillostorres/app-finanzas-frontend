import { Pipe, PipeTransform } from '@angular/core';

import { formatearCop } from '../format/moneda';

@Pipe({ name: 'monedaCop' })
export class MonedaCopPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatearCop(valor);
  }
}
