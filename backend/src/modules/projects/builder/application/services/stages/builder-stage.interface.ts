/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-stage.interface).
 *
 * @module builder-stage.interface
 */

export interface IBuilderStageHandler<TInput, TOutput> {
  handle(input: TInput): Promise<TOutput> | TOutput;
}
