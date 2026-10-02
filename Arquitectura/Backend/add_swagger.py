import os
import re

routes_dir = "src/routes"

# Regex to match router methods
pattern = re.compile(r"^(.*?)router\.(get|post|put|delete|patch)\(['\"]([^'\"]+)['\"].*$", re.MULTILINE)

def process_file(filepath, tag_name):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # If already has @swagger, skip it so we don't duplicate
    if "@swagger" in content:
        print(f"Skipping {filepath} (already documented)")
        return

    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        match = re.search(r"^(\s*)router\.(get|post|put|delete|patch)\(['\"]([^'\"]+)['\"]", line)
        if match:
            indent = match.group(1)
            method = match.group(2)
            path = match.group(3)
            
            # Format the path for swagger (e.g., /:id to /{id})
            swagger_path = re.sub(r':([a-zA-Z0-9_]+)', r'{\1}', path)
            full_path = f"/api/{tag_name.lower()}{swagger_path}"
            
            # Extract parameters
            params = re.findall(r':([a-zA-Z0-9_]+)', path)
            
            doc_lines = [
                f"{indent}/**",
                f"{indent} * @swagger",
                f"{indent} * {full_path}:",
                f"{indent} *   {method}:",
                f"{indent} *     summary: Endpoint for {method.upper()} {path}",
                f"{indent} *     tags: [{tag_name}]"
            ]
            
            if params:
                doc_lines.append(f"{indent} *     parameters:")
                for param in params:
                    doc_lines.extend([
                        f"{indent} *       - in: path",
                        f"{indent} *         name: {param}",
                        f"{indent} *         required: true",
                        f"{indent} *         schema:",
                        f"{indent} *           type: string"
                    ])
                    
            doc_lines.extend([
                f"{indent} *     responses:",
                f"{indent} *       200:",
                f"{indent} *         description: OK",
                f"{indent} */"
            ])
            
            new_lines.extend(doc_lines)
        new_lines.append(line)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write('\n'.join(new_lines))
    print(f"Documented {filepath}")

for filename in os.listdir(routes_dir):
    if filename.endswith(".routes.js"):
        filepath = os.path.join(routes_dir, filename)
        # Extract tag name from filename (e.g. auth.routes.js -> Auth)
        tag_name = filename.split('.')[0].capitalize()
        process_file(filepath, tag_name)
