// Localization (i18n) support
// Languages: English (en), Spanish (es), French (fr)

export type Language = 'en' | 'es' | 'fr';

export interface Translations {
  common: {
    loading: string;
    error: string;
    success: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    filter: string;
    refresh: string;
    download: string;
    export: string;
    noData: string;
    confirm: string;
  };
  nav: {
    dashboard: string;
    tasks: string;
    resources: string;
    analytics: string;
    fogComputing: string;
    profile: string;
    settings: string;
    logout: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    pendingTasks: string;
    availableResources: string;
    completedTasks: string;
    avgExecutionTime: string;
    mlStatus: string;
    runScheduler: string;
  };
  tasks: {
    title: string;
    subtitle: string;
    newTask: string;
    taskTitle: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string;
    assignedResource: string;
    priorities: {
      low: string;
      medium: string;
      high: string;
      urgent: string;
      critical: string;
    };
    statuses: {
      pending: string;
      scheduled: string;
      inProgress: string;
      completed: string;
      failed: string;
    };
  };
  resources: {
    title: string;
    subtitle: string;
    newResource: string;
    resourceName: string;
    capacity: string;
    currentLoad: string;
    status: string;
    statuses: {
      available: string;
      busy: string;
      offline: string;
      maintenance: string;
    };
  };
  analytics: {
    title: string;
    subtitle: string;
    mlPerformance: string;
    taskCompletion: string;
    resourceUtilization: string;
    timeline: string;
    comparison: string;
    withML: string;
    withoutML: string;
  };
  fogComputing: {
    title: string;
    subtitle: string;
    runComparison: string;
    algorithms: string;
    completionTime: string;
    energyConsumption: string;
    reliability: string;
    taskCount: string;
  };
  auth: {
    login: string;
    logout: string;
    register: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    rememberMe: string;
    noAccount: string;
    haveAccount: string;
  };
  notifications: {
    taskCreated: string;
    taskUpdated: string;
    taskDeleted: string;
    taskCompleted: string;
    resourceCreated: string;
    resourceUpdated: string;
    resourceDeleted: string;
    schedulerComplete: string;
    error: string;
  };
}

const en: Translations = {
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search...',
    filter: 'Filter',
    refresh: 'Refresh',
    download: 'Download',
    export: 'Export',
    noData: 'No data available',
    confirm: 'Confirm',
  },
  nav: {
    dashboard: 'Dashboard',
    tasks: 'Tasks',
    resources: 'Resources',
    analytics: 'Analytics',
    fogComputing: 'Fog Computing',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Logout',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of task scheduling and resource allocation',
    pendingTasks: 'Pending Tasks',
    availableResources: 'Available Resources',
    completedTasks: 'Completed Tasks',
    avgExecutionTime: 'Avg. Execution Time',
    mlStatus: 'ML Status',
    runScheduler: 'Run Scheduler',
  },
  tasks: {
    title: 'Tasks',
    subtitle: 'Manage and schedule your tasks',
    newTask: 'New Task',
    taskTitle: 'Task Title',
    description: 'Description',
    priority: 'Priority',
    status: 'Status',
    dueDate: 'Due Date',
    assignedResource: 'Assigned Resource',
    priorities: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
      critical: 'Critical',
    },
    statuses: {
      pending: 'Pending',
      scheduled: 'Scheduled',
      inProgress: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
    },
  },
  resources: {
    title: 'Resources',
    subtitle: 'Manage system resources and allocations',
    newResource: 'New Resource',
    resourceName: 'Resource Name',
    capacity: 'Capacity',
    currentLoad: 'Current Load',
    status: 'Status',
    statuses: {
      available: 'Available',
      busy: 'Busy',
      offline: 'Offline',
      maintenance: 'Maintenance',
    },
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Performance metrics and ML model effectiveness',
    mlPerformance: 'ML Performance',
    taskCompletion: 'Task Completion',
    resourceUtilization: 'Resource Utilization',
    timeline: 'Timeline',
    comparison: 'ML Comparison',
    withML: 'With ML',
    withoutML: 'Without ML',
  },
  fogComputing: {
    title: 'Fog Computing',
    subtitle: 'Smart production line task scheduling with fog computing',
    runComparison: 'Run Comparison',
    algorithms: 'Algorithms',
    completionTime: 'Completion Time',
    energyConsumption: 'Energy Consumption',
    reliability: 'Reliability',
    taskCount: 'Task Count',
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    rememberMe: 'Remember Me',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
  },
  notifications: {
    taskCreated: 'Task created successfully',
    taskUpdated: 'Task updated successfully',
    taskDeleted: 'Task deleted successfully',
    taskCompleted: 'Task marked as completed',
    resourceCreated: 'Resource created successfully',
    resourceUpdated: 'Resource updated successfully',
    resourceDeleted: 'Resource deleted successfully',
    schedulerComplete: 'Scheduler completed successfully',
    error: 'An error occurred',
  },
};

const es: Translations = {
  common: {
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    search: 'Buscar...',
    filter: 'Filtrar',
    refresh: 'Actualizar',
    download: 'Descargar',
    export: 'Exportar',
    noData: 'No hay datos disponibles',
    confirm: 'Confirmar',
  },
  nav: {
    dashboard: 'Panel',
    tasks: 'Tareas',
    resources: 'Recursos',
    analytics: 'Analíticas',
    fogComputing: 'Computación en la Niebla',
    profile: 'Perfil',
    settings: 'Configuración',
    logout: 'Cerrar Sesión',
  },
  dashboard: {
    title: 'Panel de Control',
    subtitle: 'Resumen de programación de tareas y asignación de recursos',
    pendingTasks: 'Tareas Pendientes',
    availableResources: 'Recursos Disponibles',
    completedTasks: 'Tareas Completadas',
    avgExecutionTime: 'Tiempo Prom. de Ejecución',
    mlStatus: 'Estado de ML',
    runScheduler: 'Ejecutar Planificador',
  },
  tasks: {
    title: 'Tareas',
    subtitle: 'Administrar y programar tus tareas',
    newTask: 'Nueva Tarea',
    taskTitle: 'Título de la Tarea',
    description: 'Descripción',
    priority: 'Prioridad',
    status: 'Estado',
    dueDate: 'Fecha de Vencimiento',
    assignedResource: 'Recurso Asignado',
    priorities: {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente',
      critical: 'Crítica',
    },
    statuses: {
      pending: 'Pendiente',
      scheduled: 'Programada',
      inProgress: 'En Progreso',
      completed: 'Completada',
      failed: 'Fallida',
    },
  },
  resources: {
    title: 'Recursos',
    subtitle: 'Administrar recursos del sistema y asignaciones',
    newResource: 'Nuevo Recurso',
    resourceName: 'Nombre del Recurso',
    capacity: 'Capacidad',
    currentLoad: 'Carga Actual',
    status: 'Estado',
    statuses: {
      available: 'Disponible',
      busy: 'Ocupado',
      offline: 'Desconectado',
      maintenance: 'Mantenimiento',
    },
  },
  analytics: {
    title: 'Analíticas',
    subtitle: 'Métricas de rendimiento y efectividad del modelo ML',
    mlPerformance: 'Rendimiento de ML',
    taskCompletion: 'Completación de Tareas',
    resourceUtilization: 'Utilización de Recursos',
    timeline: 'Línea de Tiempo',
    comparison: 'Comparación de ML',
    withML: 'Con ML',
    withoutML: 'Sin ML',
  },
  fogComputing: {
    title: 'Computación en la Niebla',
    subtitle: 'Programación de tareas en línea de producción inteligente con fog computing',
    runComparison: 'Ejecutar Comparación',
    algorithms: 'Algoritmos',
    completionTime: 'Tiempo de Completación',
    energyConsumption: 'Consumo de Energía',
    reliability: 'Confiabilidad',
    taskCount: 'Cantidad de Tareas',
  },
  auth: {
    login: 'Iniciar Sesión',
    logout: 'Cerrar Sesión',
    register: 'Registrarse',
    email: 'Correo Electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar Contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    rememberMe: 'Recuérdame',
    noAccount: '¿No tienes una cuenta?',
    haveAccount: '¿Ya tienes una cuenta?',
  },
  notifications: {
    taskCreated: 'Tarea creada exitosamente',
    taskUpdated: 'Tarea actualizada exitosamente',
    taskDeleted: 'Tarea eliminada exitosamente',
    taskCompleted: 'Tarea marcada como completada',
    resourceCreated: 'Recurso creado exitosamente',
    resourceUpdated: 'Recurso actualizado exitosamente',
    resourceDeleted: 'Recurso eliminado exitosamente',
    schedulerComplete: 'Planificador completado exitosamente',
    error: 'Ocurrió un error',
  },
};

const fr: Translations = {
  common: {
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    create: 'Créer',
    search: 'Rechercher...',
    filter: 'Filtrer',
    refresh: 'Actualiser',
    download: 'Télécharger',
    export: 'Exporter',
    noData: 'Aucune donnée disponible',
    confirm: 'Confirmer',
  },
  nav: {
    dashboard: 'Tableau de Bord',
    tasks: 'Tâches',
    resources: 'Ressources',
    analytics: 'Analytiques',
    fogComputing: 'Fog Computing',
    profile: 'Profil',
    settings: 'Paramètres',
    logout: 'Déconnexion',
  },
  dashboard: {
    title: 'Tableau de Bord',
    subtitle: 'Aperçu de la planification des tâches et de l\'allocation des ressources',
    pendingTasks: 'Tâches en Attente',
    availableResources: 'Ressources Disponibles',
    completedTasks: 'Tâches Terminées',
    avgExecutionTime: 'Temps Moy. d\'Exécution',
    mlStatus: 'Statut ML',
    runScheduler: 'Lancer le Planificateur',
  },
  tasks: {
    title: 'Tâches',
    subtitle: 'Gérer et planifier vos tâches',
    newTask: 'Nouvelle Tâche',
    taskTitle: 'Titre de la Tâche',
    description: 'Description',
    priority: 'Priorité',
    status: 'Statut',
    dueDate: 'Date d\'Échéance',
    assignedResource: 'Ressource Assignée',
    priorities: {
      low: 'Basse',
      medium: 'Moyenne',
      high: 'Haute',
      urgent: 'Urgente',
      critical: 'Critique',
    },
    statuses: {
      pending: 'En Attente',
      scheduled: 'Planifiée',
      inProgress: 'En Cours',
      completed: 'Terminée',
      failed: 'Échouée',
    },
  },
  resources: {
    title: 'Ressources',
    subtitle: 'Gérer les ressources système et les allocations',
    newResource: 'Nouvelle Ressource',
    resourceName: 'Nom de la Ressource',
    capacity: 'Capacité',
    currentLoad: 'Charge Actuelle',
    status: 'Statut',
    statuses: {
      available: 'Disponible',
      busy: 'Occupée',
      offline: 'Hors Ligne',
      maintenance: 'Maintenance',
    },
  },
  analytics: {
    title: 'Analytiques',
    subtitle: 'Métriques de performance et efficacité du modèle ML',
    mlPerformance: 'Performance ML',
    taskCompletion: 'Achèvement des Tâches',
    resourceUtilization: 'Utilisation des Ressources',
    timeline: 'Chronologie',
    comparison: 'Comparaison ML',
    withML: 'Avec ML',
    withoutML: 'Sans ML',
  },
  fogComputing: {
    title: 'Fog Computing',
    subtitle: 'Planification des tâches de ligne de production intelligente avec fog computing',
    runComparison: 'Lancer la Comparaison',
    algorithms: 'Algorithmes',
    completionTime: 'Temps d\'Achèvement',
    energyConsumption: 'Consommation d\'Énergie',
    reliability: 'Fiabilité',
    taskCount: 'Nombre de Tâches',
  },
  auth: {
    login: 'Connexion',
    logout: 'Déconnexion',
    register: 'S\'inscrire',
    email: 'Email',
    password: 'Mot de Passe',
    confirmPassword: 'Confirmer le Mot de Passe',
    forgotPassword: 'Mot de passe oublié ?',
    rememberMe: 'Se Souvenir de Moi',
    noAccount: 'Pas encore de compte ?',
    haveAccount: 'Déjà un compte ?',
  },
  notifications: {
    taskCreated: 'Tâche créée avec succès',
    taskUpdated: 'Tâche mise à jour avec succès',
    taskDeleted: 'Tâche supprimée avec succès',
    taskCompleted: 'Tâche marquée comme terminée',
    resourceCreated: 'Ressource créée avec succès',
    resourceUpdated: 'Ressource mise à jour avec succès',
    resourceDeleted: 'Ressource supprimée avec succès',
    schedulerComplete: 'Planificateur terminé avec succès',
    error: 'Une erreur est survenue',
  },
};

export const translations: Record<Language, Translations> = {
  en,
  es,
  fr,
};

export const getTranslation = (lang: Language): Translations => {
  return translations[lang] || translations.en;
};

export const supportedLanguages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export const detectBrowserLanguage = (): Language => {
  const browserLang = navigator.language.split('-')[0];
  return (translations[browserLang as Language] ? browserLang : 'en') as Language;
};
