import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', 'packages/cli/dashboard/**'] }, ...tseslint.configs.recommended);
