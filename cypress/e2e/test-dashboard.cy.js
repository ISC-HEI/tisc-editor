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
    cy.get(UI.createProjectBtn, { timeout: 15000 }).should('be.visible').click();
    
    cy.get(modelSelector, { timeout: 10000 }).should('be.visible').click();
    
    cy.get(UI.projectNameInput).should('be.visible').type(`${name}{enter}`);
    
    cy.contains(name, { timeout: 20000 }).should('be.visible');
  };

  before("Initial Signup", () => {
    cy.visit("/signup");
    cy.get(UI.emailInput).type(testUser.email);
    cy.get(UI.passwordInput).type(`${testUser.password}{enter}`);
    cy.url().should("include", "/dashboard");
  });

  beforeEach(() => {
    cy.visit("/login");
    cy.get(UI.emailInput).should('be.visible').type(testUser.email);
    cy.get(UI.passwordInput).type(`${testUser.password}{enter}`);
    cy.url({ timeout: 15000 }).should("include", "/dashboard");
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
        cy.visit("/dashboard");
        
        createProject(template.selector, template.name);
        
        cy.contains(template.name).click();
        
        cy.get(UI.editor.title, { timeout: 40000 }).should('contain', template.name);
        cy.get(UI.editor.container, { timeout: 40000 }).should('contain', template.keyword);
      });
    });
  });

  // --- TESTS DE COLLABORATION ---
  describe("Collaboration & Sharing", () => {
    const projectName = "Collaboration Project";
    const colleagueEmail = `colleague_${Date.now()}@exemple.com`;

    before("Create Colleague Account", () => {
      cy.visit("/signup");
      cy.get(UI.emailInput).type(colleagueEmail);
      cy.get(UI.passwordInput).type(`password{enter}`);
      cy.url().should("include", "/dashboard");
    });
  
    beforeEach(() => {
      cy.visit("/dashboard");
      createProject(UI.models.blank, projectName);
      
      cy.contains(projectName)
        .parents('.group.relative')
        .find(UI.actionMenuBtn, { timeout: 10000 })
        .should('be.visible')
        .click();
      
      cy.get(UI.shareOption, { timeout: 5000 }).should('be.visible').click();
    });

    it("should share successfully with an existing user", () => {
      cy.get(UI.shareModal.input, { timeout: 10000 }).should('be.visible').type(colleagueEmail);
      cy.get(UI.shareModal.addButton).click();
      
      cy.get(UI.shareModal.userList, { timeout: 15000 }).should('contain', colleagueEmail);
    });

    it("should not allow sharing with a user already shared", () => {
      cy.get(UI.shareModal.input).should('be.visible').type(colleagueEmail);
      cy.get(UI.shareModal.addButton).click();
      cy.get(UI.shareModal.userList, { timeout: 10000 }).should('contain', colleagueEmail);

      cy.get(UI.shareModal.input).clear().type(colleagueEmail);
      cy.get(UI.shareModal.addButton).click();

      cy.get(UI.shareModal.errorMessage, { timeout: 10000 })
        .should('be.visible')
        .contains("User already has access");
    });

    it("should not allow sharing with oneself", () => {
      cy.get(UI.shareModal.input).should('be.visible').type(testUser.email);
      cy.get(UI.shareModal.addButton).click();

      cy.get(UI.shareModal.errorMessage, { timeout: 10000 })
        .should('be.visible')
        .contains("User already has access");
      cy.get(UI.shareModal.userList).should('not.contain', testUser.email);
    });

    it("should show error for non-existent user", () => {
      const unknown = "nobody@exists.com";
      cy.get(UI.shareModal.input).should('be.visible').type(unknown);
      cy.get(UI.shareModal.addButton).click();

      cy.contains("User not found", { timeout: 10000 }).should('be.visible');
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
    cy.visit("/dashboard");
    cy.get(UI.logoutBtn, { timeout: 10000 }).should('be.visible').click();
    cy.url({ timeout: 10000 }).should("include", "/login");
  });
});