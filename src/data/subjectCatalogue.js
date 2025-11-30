// Subject Catalogue - Hierarchical structure for learning content
// Category → Subject → Topics

export const SUBJECT_CATALOGUE = {
  Mathematics: {
    name: 'Mathematics',
    icon: '📐',
    description: 'Pure and applied mathematical disciplines',
    subjects: {
      Statistics: {
        name: 'Statistics',
        icon: '📊',
        topics: [
          { id: 'descriptive', name: 'Descriptive Statistics', description: 'Mean, median, mode, variance, standard deviation' },
          { id: 'probability', name: 'Probability Basics', description: 'Basic probability rules, conditional probability, Bayes theorem' },
          { id: 'distributions', name: 'Distributions', description: 'Normal, binomial, Poisson distributions' },
          { id: 'hypothesis', name: 'Hypothesis Testing', description: 'Null hypothesis, p-values, significance levels' },
          { id: 'regression', name: 'Regression', description: 'Linear regression, correlation, R-squared' },
        ],
      },
      Calculus: {
        name: 'Calculus',
        icon: '∫',
        topics: [
          { id: 'limits', name: 'Limits', description: 'Limit definition, L\'Hôpital\'s rule, continuity' },
          { id: 'derivatives', name: 'Derivatives', description: 'Differentiation rules, chain rule, implicit differentiation' },
          { id: 'integrals', name: 'Integrals', description: 'Integration techniques, definite and indefinite integrals' },
          { id: 'applications', name: 'Applications of Derivatives', description: 'Optimization, related rates, curve sketching' },
          { id: 'series', name: 'Infinite Series', description: 'Convergence tests, Taylor series, power series' },
        ],
      },
      LinearAlgebra: {
        name: 'Linear Algebra',
        icon: '🔢',
        topics: [
          { id: 'vectors', name: 'Vectors & Spaces', description: 'Vector operations, vector spaces, subspaces' },
          { id: 'matrices', name: 'Matrix Operations', description: 'Matrix multiplication, inverse, transpose' },
          { id: 'determinants', name: 'Determinants', description: 'Determinant calculation, properties, applications' },
          { id: 'eigenvalues', name: 'Eigenvalues & Eigenvectors', description: 'Eigenvalue problems, diagonalization' },
          { id: 'transformations', name: 'Linear Transformations', description: 'Kernel, image, rank-nullity theorem' },
        ],
      },
      Probability: {
        name: 'Probability',
        icon: '🎲',
        topics: [
          { id: 'prob-basics', name: 'Probability Basics', description: 'Sample spaces, events, probability axioms' },
          { id: 'random-vars', name: 'Random Variables', description: 'Discrete and continuous random variables, PMF, PDF' },
          { id: 'distributions-prob', name: 'Distributions', description: 'Common distributions: uniform, exponential, normal' },
          { id: 'expected-value', name: 'Expected Value & Variance', description: 'Expectation, variance, covariance, moments' },
          { id: 'bayes', name: 'Bayes\' Theorem', description: 'Conditional probability, Bayesian inference' },
        ],
      },
      ProbabilityForInference: {
        name: 'Probability for Inference',
        icon: '🎲',
        topics: [
          { id: 'convergence', name: 'Convergence Concepts', description: 'Convergence in probability, almost sure, in distribution, in mean; LLN, CLT' },
          { id: 'estimation', name: 'Point Estimation', description: 'Method of moments, maximum likelihood estimation, properties of estimators (bias, consistency, efficiency)' },
          { id: 'sufficiency', name: 'Sufficiency & Completeness', description: 'Sufficient statistics, factorization theorem, minimal sufficiency, completeness, Rao-Blackwell' },
          { id: 'hypothesis', name: 'Hypothesis Testing Theory', description: 'Neyman-Pearson lemma, likelihood ratio tests, UMP tests, p-values' },
          { id: 'interval', name: 'Interval Estimation', description: 'Confidence intervals, pivotal quantities, coverage probability, relationship to hypothesis tests' },
          { id: 'bayesian', name: 'Bayesian Inference', description: 'Prior and posterior distributions, conjugate priors, credible intervals, Bayesian vs frequentist' },
        ],
      },
      LinearStatisticalModels: {
        name: 'Linear Statistical Models',
        icon: '📈',
        topics: [
          { id: 'slr', name: 'Simple Linear Regression', description: 'Least squares estimation, model assumptions, inference on coefficients, prediction' },
          { id: 'mlr', name: 'Multiple Linear Regression', description: 'Matrix formulation, parameter estimation, interpretation, adjusted R²' },
          { id: 'model-diagnostics', name: 'Model Diagnostics', description: 'Residual analysis, leverage, influential points, multicollinearity, VIF' },
          { id: 'model-selection', name: 'Model Selection', description: 'Variable selection, AIC/BIC, stepwise methods, cross-validation' },
          { id: 'anova', name: 'ANOVA & Experimental Design', description: 'One-way/two-way ANOVA, F-tests, contrasts, factorial designs' },
          { id: 'glm-intro', name: 'Generalized Linear Models Intro', description: 'Link functions, logistic regression, Poisson regression, deviance' },
        ],
      },
    },
  },
  ComputerScience: {
    name: 'Computer Science',
    icon: '💻',
    description: 'Computing fundamentals and software development',
    subjects: {
      ComputerScience: {
        name: 'Computer Science',
        icon: '💻',
        topics: [
          { id: 'algorithms', name: 'Algorithm Basics', description: 'Algorithm design, correctness, efficiency' },
          { id: 'data-structures', name: 'Data Structures', description: 'Arrays, linked lists, trees, graphs, hash tables' },
          { id: 'complexity', name: 'Time Complexity', description: 'Big O notation, time and space analysis' },
          { id: 'recursion', name: 'Recursion', description: 'Recursive thinking, base cases, recursive algorithms' },
          { id: 'sorting', name: 'Sorting Algorithms', description: 'Bubble, merge, quick, heap sort and comparisons' },
        ],
      },
      ArtificialIntelligence: {
        name: 'Artificial Intelligence',
        icon: '🤖',
        topics: [
          { id: 'search', name: 'Search Algorithms', description: 'Uninformed search (BFS, DFS), informed search (A*, greedy), heuristics' },
          { id: 'adversarial', name: 'Adversarial Search', description: 'Game trees, minimax, alpha-beta pruning, Monte Carlo tree search' },
          { id: 'csp', name: 'Constraint Satisfaction', description: 'CSP formulation, backtracking, arc consistency, constraint propagation' },
          { id: 'logic', name: 'Logic & Reasoning', description: 'Propositional logic, first-order logic, inference, knowledge representation' },
          { id: 'uncertainty', name: 'Uncertainty & Bayes Nets', description: 'Probability review, Bayesian networks, inference, decision making under uncertainty' },
          { id: 'ml-intro', name: 'Machine Learning Basics', description: 'Supervised learning, decision trees, neural network fundamentals, evaluation' },
        ],
      },
    },
  },
  Sciences: {
    name: 'Sciences',
    icon: '🔬',
    description: 'Natural and physical sciences',
    subjects: {},
  },
  SocialSciences: {
    name: 'Social Sciences',
    icon: '🌍',
    description: 'Study of human society and relationships',
    subjects: {},
  },
};

/**
 * Returns a flat object of all subjects (for backward compatibility)
 * Merges subjects from all categories into a single object
 */
export function getAllSubjects() {
  const allSubjects = {};
  
  for (const categoryKey in SUBJECT_CATALOGUE) {
    const category = SUBJECT_CATALOGUE[categoryKey];
    for (const subjectKey in category.subjects) {
      allSubjects[subjectKey] = category.subjects[subjectKey];
    }
  }
  
  return allSubjects;
}

/**
 * Returns the category key a subject belongs to
 * @param {string} subjectKey - The key of the subject to find
 * @returns {string|null} - The category key or null if not found
 */
export function getCategoryForSubject(subjectKey) {
  for (const categoryKey in SUBJECT_CATALOGUE) {
    const category = SUBJECT_CATALOGUE[categoryKey];
    if (category.subjects[subjectKey]) {
      return categoryKey;
    }
  }
  return null;
}
