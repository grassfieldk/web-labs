import { halfToFullWidth } from "@/utils/stringConverter";

type TranslateResult = {
  output: string;
  message: string | null;
  fullWidthInput: string;
};

const SYMBOLS = "！？「」『』（）【】○◯●△▲▽▼＝♡♥☆★↑↓←→、。～ーっッ";

const isKana = (ch: string) => /^[\u3040-\u309F\u30A0-\u30FF]$/.test(ch);

const isHiragana = (ch: string) => /^[\u3040-\u309F]$/.test(ch);

const isKatakana = (ch: string) => /^[\u30A0-\u30FF]$/.test(ch);

const isSmallOrVowelKana = (ch: string) =>
  "あかさたなはまやらわえけせてねへめれぁゃ".includes(ch);

const isVoicedKana = (ch: string) => "がざだばげぜでべ".includes(ch);

const isVuLikeKana = (ch: string) => "ゔぎじぢびぐずづぶごぞどぼ".includes(ch);

export const translateUmatomaText = (input: string): TranslateResult => {
  let trimmed = false;
  let result = "";
  const fullWidthInput = halfToFullWidth(input, true);

  if (!/[ぁ-んァ-ン]/.test(fullWidthInput)) {
    return {
      output: "",
      message: "うまトマ語に対応しているのは ひらがな または カタカナ のみです",
      fullWidthInput,
    };
  }

  for (const ch of fullWidthInput) {
    if (ch === "\n") {
      result += "\n";
      continue;
    }
    if (ch === " ") {
      result += " ";
      continue;
    }
    if (SYMBOLS.includes(ch)) {
      result += ch;
      continue;
    }

    if (isHiragana(ch)) {
      if (isSmallOrVowelKana(ch) || isVoicedKana(ch)) {
        result += "ま";
      } else if (isVuLikeKana(ch)) {
        result += "ゔ";
      } else {
        result += "う";
      }
      continue;
    }

    if (isKatakana(ch)) {
      result += "マ";
      continue;
    }

    if (!isKana(ch)) {
      trimmed = true;
    }
  }

  return {
    output: result,
    message: trimmed ? "うまトマ語に非対応の文字は煮込む過程で消滅しました" : null,
    fullWidthInput,
  };
};
