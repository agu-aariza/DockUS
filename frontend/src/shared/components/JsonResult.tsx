import { pretty } from '../utils/errors';

interface JsonResultProps {
  title: string;
  value: unknown;
}

export function JsonResult({ title, value }: JsonResultProps): JSX.Element {
  return (
    <section className="card">
      <h4>{title}</h4>
      <pre className="json-block">{pretty(value)}</pre>
    </section>
  );
}
