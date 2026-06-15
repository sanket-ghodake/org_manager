import os
import re
import sys

PROJECT_ROOT = "/home/sanket/Desktop/Sanket/org_website"

# Mappings of workspace directories to aliases
# Targets are relative to PROJECT_ROOT
ALIASES = [
    {"prefix": "src/backend/", "alias": "@backend/"},
    {"prefix": "src/database/", "alias": "@database/"},
    {"prefix": "src/apps/", "alias": "@apps/"},
    {"prefix": "src/sdk/", "alias": "@sdk/"},
    {"prefix": "test/", "alias": "@test/"},
]

# Regex patterns to find imports, exports, and requires
IMPORT_PATTERNS = [
    # import ... from '...'
    re.compile(r'(from\s+[\'"])([^\'"]+)([\'"])'),
    # import('...')
    re.compile(r'(import\([\'"])([^\'"]+)([\'"]\))'),
    # require('...')
    re.compile(r'(require\([\'"])([^\'"]+)([\'"]\))'),
    # export ... from '...'
    re.compile(r'(export\s+.*from\s+[\'"])([^\'"]+)([\'"])'),
]

def resolve_target_path(file_dir, rel_path):
    # Normalize the relative path
    abs_path = os.path.abspath(os.path.join(file_dir, rel_path))
    # Get relative to PROJECT_ROOT
    rel_to_root = os.path.relpath(abs_path, PROJECT_ROOT)
    return rel_to_root

def find_alias(file_path, target_rel_to_root):
    # Check if the importing file is inside src/frontend
    file_rel_to_root = os.path.relpath(file_path, PROJECT_ROOT)
    is_frontend_file = file_rel_to_root.startswith("src/frontend")

    # If target is inside src/frontend, and the importing file is also inside src/frontend,
    # use the Next.js @/* alias.
    if is_frontend_file and target_rel_to_root.startswith("src/frontend/"):
        sub_path = target_rel_to_root[len("src/frontend/"):]
        return f"@/{sub_path}"

    # For other mappings
    for item in ALIASES:
        if target_rel_to_root.startswith(item["prefix"]):
            sub_path = target_rel_to_root[len(item["prefix"]):]
            return f"{item['alias']}{sub_path}"
            
    # If target is src/frontend but the importing file is NOT in src/frontend
    if target_rel_to_root.startswith("src/frontend/"):
        sub_path = target_rel_to_root[len("src/frontend/"):]
        return f"@frontend/{sub_path}"

    return None

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    file_dir = os.path.dirname(file_path)
    modified = False
    new_content = content

    # We will search and replace relative imports
    # To avoid matching inside comments, we can do line-by-line or full-text regex.
    # Let's do line-by-line to be precise.
    lines = content.split('\n')
    for idx, line in enumerate(lines):
        # Skip commented lines
        if line.strip().startswith('//') or line.strip().startswith('*'):
            continue

        for pattern in IMPORT_PATTERNS:
            def repl(match):
                nonlocal modified
                prefix, rel_path, suffix = match.groups()
                
                # We only want to convert relative imports that go up (i.e. contain "..")
                # Sibling imports (./) can remain relative unless they go up or we want them absolute.
                # The user request is "avoid all relative imports - relative imports can fail anytime if we change the structure".
                # If we restructure, moving a file will break even sibling imports unless the alias is used.
                # So let's check if the path starts with "." (both "./" and "../").
                if rel_path.startswith('.'):
                    target_rel_to_root = resolve_target_path(file_dir, rel_path)
                    alias_path = find_alias(file_path, target_rel_to_root)
                    if alias_path:
                        # Normalize slashes just in case
                        alias_path = alias_path.replace('\\', '/')
                        # Keep filename or directory extension neatness
                        # Next.js / TypeScript doesn't require index.tsx or extensions in imports,
                        # but let's keep whatever suffix/prefix is there.
                        modified = True
                        print(f"[{os.path.basename(file_path)}:{idx+1}] {rel_path} -> {alias_path}")
                        return f"{prefix}{alias_path}{suffix}"
                return match.group(0)

            lines[idx] = pattern.sub(repl, line)

    if modified:
        new_content = '\n'.join(lines)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

def main():
    print("Starting audit of relative imports...")
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Skip node_modules, .git, .next, dist, etc.
        if any(ignored in root for ignored in ["node_modules", ".git", ".next", "graphify-out", "portables"]):
            continue
        
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                file_path = os.path.join(root, file)
                process_file(file_path)
    print("Finished audit and replacement.")

if __name__ == "__main__":
    main()
