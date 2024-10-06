import math
import re
from enum import Enum


class TokenType(Enum):
    CHARACTER = "ch"
    NUMBER = "nm"
    OPERATION = "op"
    EQUAL = "="


class Token:
    def __init__(self, token_type: TokenType, value: str):
        self.type = token_type
        self.value = value

    def __repr__(self):
        return f"Token(type={self.type.value}, value={self.value})"


class Tokenizer:
    OPERATIONS = ("=", "*", "+", "-", "div", "times", "forward_slash", ",", "sqrt")

    def __init__(self, expression_list):
        self.expression_list = expression_list
        self.tokens = []
        self.current_index = 0

    def tokenize(self):
        while self.current_index < len(self.expression_list):
            token, self.current_index = self._check_token(self.current_index)
            self.tokens.append(token)
        return self.tokens

    def _check_token(self, i):
        char = self.expression_list[i]
        if char in ("(", ")"):
            return Token(TokenType.CHARACTER, char), i + 1
        if char.isdigit():
            return self._extract_number(i)

        if char in self.OPERATIONS:
            char = self.clean_operation(char)
            return Token(TokenType.OPERATION, char), i + 1

        if char.upper() == "X":
            return self._handle_character_or_operation(i)

        return Token(TokenType.CHARACTER, char), i + 1

    def _extract_number(self, i):
        start = i
        while i < len(self.expression_list) and self.expression_list[i].isdigit():
            i += 1
        return Token(TokenType.NUMBER, ''.join(self.expression_list[start:i])), i

    def _handle_character_or_operation(self, i):
        char = self.expression_list[i].upper()

        if i == 0 or i + 1 == len(self.expression_list) or self.expression_list[i + 1] in self.OPERATIONS:
            return Token(TokenType.CHARACTER, char), i + 1

        next_token, new_i = self._check_token(i + 1)
        if next_token.type == TokenType.NUMBER:
            return Token(TokenType.OPERATION, "*"), i + 1
        else:
            raise ValueError(f"Unknown at {i}")
        return self._extract_variable(i)

    def clean_operation(self, char):
        if char in ("div", "forward_slash", ","):
            return "/"
        if char == "times":
            return "*"
        return char

    def _extract_variable(self, i):
        start = i
        while i < len(self.expression_list) and self.expression_list[i].isalpha():
            i += 1
        return Token(TokenType.CHARACTER, ''.join(self.expression_list[start:i])), i


class ASTNode:
    def __init__(self, type, value=None):
        self.type = type
        self.value = value
        self.children = []

    def add_child(self, child):
        self.children.append(child)

    def __iter__(self):
        yield from self.children

    def __repr__(self):
        return f"ASTNode({self.type}, {repr(self.value)}, {self.children})"


class ASTNode:
    def __init__(self, value, left=None, right=None):
        self.value = value  # Value can be an operator, variable, or number
        self.left = left  # Left child (for binary operations)
        self.right = right  # Right child (for binary operations)

    def __repr__(self):
        if not self.left and not self.right:
            return f"ASTNode({self.value})"
        return f"ASTNode({self.value}, left={self.left}, right={self.right})"

    def evaluate(self, defined_variables):
        left_val = self.left.evaluate(defined_variables)
        right_val = self.right.evaluate(defined_variables)

        # Apply the operator
        if self.value == '+':
            return left_val + right_val
        elif self.value == '-':
            return left_val - right_val
        elif self.value == '*':
            return left_val * right_val
        elif self.value == '/':
            return left_val / right_val
        else:
            raise ValueError(f"Unknown operator: {self.value}")


class NumberNode(ASTNode):
    def __init__(self, value):
        super().__init__(value)

    def evaluate(self, defined_variables):
        return self.value


class FunctionNode(ASTNode):
    def __init__(self, operation, value):
        super().__init__(value)
        self.operation = operation

    def evaluate(self, defined_variables):
        value = self.value.evaluate(defined_variables)
        if self.operation == "sqrt":
            return math.sqrt(value)


class VariableNode(ASTNode):
    def __init__(self, variable):
        super().__init__(variable)

    def evaluate(self, defined_variables):
        if self.value in defined_variables:
            return defined_variables[self.value]
        raise ValueError(f"Unknown variable {self.value}")


class AssignmentNode(ASTNode):
    def __init__(self, left, right):
        super().__init__("", left, right)

    def evaluate(self, defined_variables):
        left = self.left
        right = self.right
        if right is None:
            raise ValueError("Assignment with no right side")
        right = right.evaluate(defined_variables)

        defined_variables[left.value] = right


class Parser:
    def __init__(self, expression, tokens):
        self.expression = expression
        self.tokens = tokens
        self.current_index = 0

    def parse(self):
        """ Parse the tokens and return the root of the AST """
        return self._parse_expression()

    def _parse_expression(self):
        """ Parse the lowest precedence level (handles assignment) """
        left = self._parse_term()  # Handle the first term
        while self._current_token_is(
                TokenType.OPERATION) and self._current_token_value() == "=" and self.current_index < len(self.tokens):
            self._advance()  # Move past '='
            right = self._parse_term()  # Parse the right-hand side
            left = AssignmentNode(left, right)  # Assign the result of the RHS to the LHS
        return left

    def _parse_term(self):
        """ Parse the next precedence level (handles + and -) """
        left = self._parse_factor()  # Start by parsing the first factor
        while self._current_token_is(TokenType.OPERATION) and self._current_token_value() in ("+", "-"):
            operator = self._current_token_value()
            self._advance()
            right = self._parse_factor()  # Parse the next factor
            left = ASTNode(operator, left, right)  # Create a binary operation node
        return left

    def _parse_factor(self):
        """ Parse the highest precedence level (handles * and /) """
        if self._current_token_is(TokenType.OPERATION) and self._current_token_value() == "sqrt":
            self._advance()
            return FunctionNode("sqrt", self._parse_expression())
        left = self._parse_primary()

        while self._current_token_is(TokenType.OPERATION) and self._current_token_value() in ("*", "div", "times",
                                                                                              "forward_slash"):
            operator = self._current_token_value()
            self._advance()
            right = self._parse_primary()
            left = ASTNode(operator, left, right)
        return left

    def _parse_primary(self):
        """ Parse a single token (number, variable, or parenthesized expression) """
        token = self._current_token()

        # Handle parentheses by recursively parsing the sub-expression
        if token.type == TokenType.CHARACTER and token.value == "(":
            self._advance()  # Consume '('
            expr = self._parse_expression()  # Recursively parse the sub-expression
            if not (self._current_token_is(TokenType.CHARACTER) and self._current_token_value() == ")"):
                raise ValueError("Mismatched parentheses")
            self._advance()  # Consume ')'
            return expr

        if token.type == TokenType.NUMBER:
            self._advance()  # Consume the token
            return NumberNode(int(token.value))
        if token.type == TokenType.CHARACTER:
            self._advance()
            return VariableNode(token.value)
        raise ValueError(f"Unexpected token: {token}")

    def _current_token(self):
        """ Return the current token """
        return self.tokens[self.current_index]

    def _current_token_is(self, token_type):
        """ Check if the current token is of a specific type """
        return self.current_index < len(self.tokens) and self.tokens[self.current_index].type == token_type

    def _current_token_value(self):
        """ Return the value of the current token """
        return self.tokens[self.current_index].value

    def _advance(self):
        """ Move to the next token """
        self.current_index += 1


# Example usage:


def evaluate(expression_list, vars):
    if expression_list[-1] == "=":
        # If its a normal expression and waiting a result we should ignore the =
        expression_list = expression_list[:-1]
    expression = " ".join(expression_list)
    tokenizer = Tokenizer(expression_list)
    tokens = tokenizer.tokenize()
    print("Tokens:", tokens)
    # Parsing the tokens into an AST
    parser = Parser(expression, tokens)
    ast = parser.parse()
    result = ast.evaluate(vars)
    if isinstance(ast, ASTNode):
        return result
    return None


if __name__ == '__main__':
    e = ["sqrt", "(", "9", ")"]
    print(evaluate(e))
