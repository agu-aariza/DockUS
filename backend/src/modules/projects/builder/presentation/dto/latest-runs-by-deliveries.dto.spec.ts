import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  LatestRunsByDeliveriesQueryDto,
  MAX_LATEST_RUNS_DELIVERY_IDS,
} from './latest-runs-by-deliveries.dto';

const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

describe('LatestRunsByDeliveriesQueryDto', () => {
  it('splits a comma-separated string into a deduplicated, trimmed array', async () => {
    const dto = plainToInstance(LatestRunsByDeliveriesQueryDto, {
      deliveryIds: ` ${UUID_A} , ${UUID_B} , ${UUID_A} `,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.deliveryIds).toEqual([UUID_A, UUID_B]);
  });

  it('rejects an empty deliveryIds list', async () => {
    const dto = plainToInstance(LatestRunsByDeliveriesQueryDto, {
      deliveryIds: '',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-UUID entry', async () => {
    const dto = plainToInstance(LatestRunsByDeliveriesQueryDto, {
      deliveryIds: `${UUID_A},not-a-uuid`,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it(`rejects more than ${MAX_LATEST_RUNS_DELIVERY_IDS} ids`, async () => {
    const tooMany = Array.from(
      { length: MAX_LATEST_RUNS_DELIVERY_IDS + 1 },
      (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${i.toString(16).padStart(2, '0')}`,
    ).join(',');
    const dto = plainToInstance(LatestRunsByDeliveriesQueryDto, {
      deliveryIds: tooMany,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
/**
 * Pruebas del DTO que agrupa la última ejecución visible por entrega.
 */
