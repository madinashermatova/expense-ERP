// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    /*
     * TZ 4.3 — foydalanuvchiga ko'rinadigan matn kodda qolmasligi kerak.
     *
     * Tekshiruv aynan `message:` maydonidagi satrga qaratilgan: xato va validatsiya
     * xabarlari shu maydon orqali javobga tushadi, ya'ni i18n kaliti (`errors.*`,
     * `validation.*`) yoki `validationMessage(...)` chaqiruvi bo'lishi kerak.
     * Log va izohlar bu qoidaga kirmaydi — ular foydalanuvchiga ko'rinmaydi.
     */
    files: ['src/**/*.ts'],
    ignores: ['src/config/**', 'src/i18n/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Property[key.name='message'] > :matches(Literal, TemplateLiteral)",
          message:
            "Xabar matni kodda qolmasin: i18n kalitini bering (`messageKey`) yoki `validationMessage('validation.KEY')` ishlatilsin (TZ 4.3).",
        },
      ],
    },
  },
  {
    // Testlarda supertest `res.body` ni `any` qaytaradi va Prisma fixture larida
    // qisman obyektlar ishlatiladi — bu qoidalar test kodida shovqin hosil qiladi.
    files: ['test/**/*.ts', 'prisma/seed.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
