export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "web",
        "supabase",
        "auth",
        "tracking",
        "crs",
        "engagement",
        "chat",
        "plan",
        "rls",
        "ci",
        "deps",
        "config",
      ],
    ],
  },
};
