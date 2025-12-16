declare module "kuromoji" {
  export interface Token {
    surface_form: string;
    pos: string;
    pos1?: string;
    pos2?: string;
    pos3?: string;
    pos4?: string;
    pos5?: string;
    pos6?: string;
    base_form?: string;
    reading_form?: string;
    phonetic_form?: string;
  }

  export interface Tokenizer {
    tokenize(text: string): Token[];
  }

  export interface Builder {
    build(callback: (err: Error | null, tokenizer?: Tokenizer) => void): void;
  }

  export function builder(options?: { dicPath?: string }): Builder;
}
