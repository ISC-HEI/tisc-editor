Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('NEXT_REDIRECT')) return false;
});

describe("Dashboard, Templates & Collaboration", () => {
  const UI = {
    emailInput: '#email',
    passwordInput: '#password',
    logoutBtn: '[data-test="logout-button"]',
    createProjectBtn: '[data-test="create-project-button"]',
    projectNameInput: '[data-test="project-name-input"]',
    projectList: '[data-test="project-list"]',
    
    models: {
      blank: '[data-test="Blank Project"]',
      execSummary: '[data-test="ISC-HEI Exec Summary"]',
      bThesis: '[data-test="ISC-HEI BThesis"]',
      report: '[data-test="ISC-HEI Report"]'
    },

    editor: {
      container: '.monaco-editor',
      title: '[data-test="editor-title"]',
    },

    actionMenuBtn: 'button:has(svg.lucide-ellipsis)',
    shareOption: 'button:contains("Share")',
    shareModal: {
      input: 'input[type="email"]',
      addButton: '[data-test="add-shared-user"]',
      userList: '[data-test="shared-user-container"]', 
      removeBtn: 'button[title="Remove access"]',
      closeBtn: 'button:contains("Done")',
      errorMessage: '.text-red-500'
    }
  };

  const testUser = {
    email: `test_${Date.now()}@exemple.com`,
    password: "Password123!"
  };

  const createProject = (modelSelector, name) => {
    cy.get(UI.createProjectBtn).click();
    cy.get(modelSelector).click();
    cy.get(UI.projectNameInput).type(`${name}{enter}`);
    cy.contains(name, { timeout: 10000 }).should('be.visible');
  };

  before("Initial Signup", () => {
    cy.visit("/signup");
    cy.get(UI.emailInput).type(testUser.email);
    cy.get(UI.passwordInput).type(`${testUser.password}{enter}`);
    cy.url().should("include", "/dashboard");
  });

  beforeEach(() => {
    cy.visit("/login");
    cy.get(UI.emailInput).type(testUser.email);
    cy.get(UI.passwordInput).type(`${testUser.password}{enter}`);
  });

  // --- TESTS DES TEMPLATES ---
  describe("Templates", () => {
    const templates = [
      { name: "My Exec Summary", selector: UI.models.execSummary, keyword: "isc-hei-exec-summary" },
      { name: "My Bachelor Thesis", selector: UI.models.bThesis, keyword: "isc-hei-bthesis" },
      { name: "My Annual Report", selector: UI.models.report, keyword: "isc-hei-report" }
    ];

    templates.forEach((template) => {
      it(`should create project with template: ${template.name}`, () => {
        createProject(template.selector, template.name);
        cy.contains(template.name).click();
        cy.get(UI.editor.title, { timeout: 30000 }).should('contain', template.name);
        cy.get(UI.editor.container).should('contain', template.keyword);
      });
    });
  });

  // --- TESTS DE COLLABORATION ---
  describe("Collaboration & Sharing", () => {
    const projectName = "Collaboration Project";
    const colleagueEmail = `colleague_${Date.now()}@exemple.com`;

    before(() => {
      cy.visit("/signup")
      cy.get(UI.emailInput).type(colleagueEmail);
      cy.get(UI.passwordInput).type(`password{enter}`);
      cy.url().should("include", "/dashboard");
    });
  
    beforeEach(() => {
      createProject(UI.models.blank, projectName);
      cy.contains(projectName)
        .parents('.group.relative')
        .find(UI.actionMenuBtn)
        .click();
      cy.get(UI.shareOption).click();
    });

    it("should share successfully with an existing user", () => {
      cy.get(UI.shareModal.input).type(colleagueEmail);
      cy.get(UI.shareModal.addButton).click();
      
      cy.get(UI.shareModal.userList, { timeout: 10000 }).should('contain', colleagueEmail);
    });

    it("should not allow sharing with a user already shared", () => {
      cy.get(UI.shareModal.input).type(colleagueEmail);
      cy.get(UI.shareModal.addButton).click();
      cy.get(UI.shareModal.userList).should('contain', colleagueEmail);

      cy.get(UI.shareModal.input).clear().type(colleagueEmail);
      cy.get(UI.shareModal.addButton).click();

      cy.get(UI.shareModal.errorMessage).should('be.visible').contains("User already has access");
    });

    it("should not allow sharing with oneself", () => {
      cy.get(UI.shareModal.input).type(testUser.email);
      cy.get(UI.shareModal.addButton).click();

      cy.get(UI.shareModal.errorMessage).should('be.visible').contains("User already has access");
      cy.get(UI.shareModal.userList).should('not.contain', testUser.email);
    });

    it("should show error for non-existent user", () => {
      const unknown = "nobody@exists.com";
      cy.get(UI.shareModal.input).type(unknown);
      cy.get(UI.shareModal.addButton).click();

      cy.contains("User not found").should('be.visible');
    });

    afterEach(() => {
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Done")').length > 0) {
          cy.get(UI.shareModal.closeBtn).click();
        }
      });
    });
  });

  it("should allow logout", () => {
    cy.get(UI.logoutBtn).click();
    cy.url().should("include", "/login");
  });
});