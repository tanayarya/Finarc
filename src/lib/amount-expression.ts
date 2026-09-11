import Decimal from "decimal.js";

/**
 * Evaluates a small, deliberately constrained arithmetic expression for money inputs.
 * Returns null for incomplete or invalid expressions so normal form validation can handle it.
 */
export function evaluateAmountExpression(input: string): string | null {
  const source = input.trim();
  if (!source || !/[+\-*/()]/.test(source)) return null;
  if (!/^[\d\s.+\-*/()]+$/.test(source)) return null;

  const tokens = source.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!tokens || tokens.join("") !== source.replace(/\s/g, "")) return null;

  let position = 0;

  const parseExpression = (): Decimal | null => {
    let value = parseTerm();
    while (value && (tokens[position] === "+" || tokens[position] === "-")) {
      const operator = tokens[position++];
      const right = parseTerm();
      if (!right) return null;
      value = operator === "+" ? value.plus(right) : value.minus(right);
    }
    return value;
  };

  const parseTerm = (): Decimal | null => {
    let value = parseFactor();
    while (value && (tokens[position] === "*" || tokens[position] === "/")) {
      const operator = tokens[position++];
      const right = parseFactor();
      if (!right || (operator === "/" && right.isZero())) return null;
      value = operator === "*" ? value.mul(right) : value.div(right);
    }
    return value;
  };

  const parseFactor = (): Decimal | null => {
    const token = tokens[position++];
    if (!token) return null;

    if (token === "+" || token === "-") {
      const value = parseFactor();
      return value ? (token === "-" ? value.neg() : value) : null;
    }

    if (token === "(") {
      const value = parseExpression();
      if (!value || tokens[position++] !== ")") return null;
      return value;
    }

    if (/^\d/.test(token)) {
      try {
        return new Decimal(token);
      } catch {
        return null;
      }
    }

    return null;
  };

  const result = parseExpression();
  if (!result || position !== tokens.length || !result.isFinite()) return null;

  return result.toDecimalPlaces(2).toFixed(2);
}
