describe("Authentication Flow", () => {
  const UI = {
    loginForm: '[data-test="login-form"]',
    emailInput: '#email',
    passwordInput: '#password',
    submitBtn: '[data-test="button-submit"]',
    errorMsg: '[data-test="error-container"]'
  };

  describe("Protected Route Redirection", () => {
    const protectedRoutes = [
      "/",
      "/?projectId=5bbd4603-cd52-4a92-a825-4b98e9b941c7",
      "/dashboard"
    ];

    protectedRoutes.forEach((route) => {
      it(`should redirect from ${route} to login page`, () => {
        cy.visit(route);
        cy.url().should("include", "/login");
        cy.get(UI.loginForm).should("be.visible");
      });
    });
  });

  describe("Login Validation", () => {
    beforeEach(() => {
      cy.visit("/login");
    });

    it("should display an error message with invalid credentials", () => {
      cy.get(UI.emailInput).type("wrong_email@hevs.ch");
      cy.get(UI.passwordInput).type("wrongPassword{enter}");
      
      cy.get(UI.errorMsg)
        .should("be.visible")
        .and("contain.text", "Incorrect credentials.");
    });
  });

  describe("Sign Up Flow", () => {
    beforeEach(() => {
      cy.visit("/signup");
    });

    it("should create an account and redirect to dashboard", () => {
      const uniqueEmail = `testuser+${Date.now()}@gmail.com`; // Use an email with an allowed domain
      
      cy.get(UI.emailInput).type(uniqueEmail);
      cy.get(UI.passwordInput).type("SecurePass123{enter}");
      
      cy.url().should("include", "/dashboard");
    });

    it("should refuse to create an account if user already exists", () => {
      const existingEmail = `existing_${Date.now()}@hevs.ch`; // Use an email with an allowed domain

      cy.visit("/signup");
      cy.get(UI.emailInput).type(existingEmail);
      cy.get(UI.passwordInput).type("Password123{enter}");
      
      cy.url().should("include", "/dashboard");

      cy.visit("/signup");
      cy.get(UI.emailInput).type(existingEmail);
      cy.get(UI.passwordInput).type("Password123{enter}");
      
      cy.get(UI.errorMsg)
        .should("be.visible")
        .and("contain.text", "User already registered.");
    });
  })
});