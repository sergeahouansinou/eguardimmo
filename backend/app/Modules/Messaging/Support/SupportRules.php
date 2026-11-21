<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

/**
 * Délais de la décision 8 de l'ADR 0033 (cycle d'une demande) et durées de la décision 9 (accès du support).
 */
final class SupportRules
{
    public const int REOUVERTURE_JOURS = 14;

    public const int RESOLUTION_AUTO_JOURS = 7;

    public const int ACCES_DUREE_DEFAUT_HEURES = 24;

    public const int ACCES_DUREE_MAX_HEURES = 72;

    public const int ACCES_URGENCE_HEURES = 1;

    public const int ACCES_DEMANDE_JOURS = 7;

    public const int ACCES_URGENCE_PLAFOND_PAR_JOUR = 3;
}
