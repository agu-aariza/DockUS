import ast
import json
import sys
import os

def analyze_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return None

    try:
        tree = ast.parse(content)
    except Exception:
        return {"error": "SyntaxError"}

    classes = []
    functions = []
    env_vars = set()

    class Analyzer(ast.NodeVisitor):
        def visit_ClassDef(self, node):
            methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
            classes.append({
                "name": node.name,
                "methods": methods
            })
            self.generic_visit(node)

        def visit_FunctionDef(self, node):
            decorators = []
            for d in node.decorator_list:
                if isinstance(d, ast.Name):
                    decorators.append(d.id)
                elif isinstance(d, ast.Call) and getattr(d.func, 'id', None):
                    decorators.append(d.func.id)
                elif isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute):
                    decorators.append(f"{getattr(d.func.value, 'id', '')}.{d.func.attr}".strip('.'))
                elif isinstance(d, ast.Attribute):
                    decorators.append(d.attr)

            args = [a.arg for a in node.args.args]
            functions.append({
                "name": node.name,
                "args": args,
                "decorators": decorators
            })
            self.generic_visit(node)

        def visit_Call(self, node):
            if isinstance(node.func, ast.Attribute):
                if getattr(node.func.value, 'id', '') == 'os' and node.func.attr in ('getenv', 'environ.get'):
                    if node.args and isinstance(node.args[0], ast.Constant):
                        env_vars.add(str(node.args[0].value))
            self.generic_visit(node)

        def visit_Subscript(self, node):
            if isinstance(node.value, ast.Attribute) and getattr(node.value.value, 'id', '') == 'os' and node.value.attr == 'environ':
                if isinstance(node.slice, ast.Constant):
                    env_vars.add(str(node.slice.value))
            self.generic_visit(node)

    Analyzer().visit(tree)
    return {
        "classes": classes,
        "functions": functions,
        "env_vars": list(env_vars)
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No target directory provided"}))
        sys.exit(1)
    
    target_dir = sys.argv[1]
    result = {}
    
    for root, _, files in os.walk(target_dir):
        if '.venv' in root or '__pycache__' in root or '.git' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                relpath = os.path.relpath(filepath, target_dir)
                analysis = analyze_file(filepath)
                if analysis:
                    result[relpath] = analysis

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
