export interface IBuilderStageHandler<TInput, TOutput> {
  handle(input: TInput): Promise<TOutput> | TOutput;
}
