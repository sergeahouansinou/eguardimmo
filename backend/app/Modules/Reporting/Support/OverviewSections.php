<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Identity\Enums\OperatorRole;

/**
 * Sections de l'accueil de la console par rôle, alignées sur la matrice de l'ADR 0037 § 3 : une section n'est servie qu'aux rôles qui lisent
 * déjà le domaine correspondant. `engineering` ne lit que la santé : il n'a pas d'accueil.
 */
final class OverviewSections
{
    public const string ORGANISATIONS = 'organizations';

    public const string COMPTES = 'user_accounts';

    public const string ABONNEMENTS = 'subscriptions';

    public const string SUPPORT = 'support';

    public const string RGPD = 'privacy';

    /**
     * @param  list<OperatorRole>  $roles
     * @return list<string>
     */
    public static function pour(array $roles): array
    {
        $sections = [];

        foreach (self::MATRICE as $section => $autorises) {
            if (array_filter($roles, fn (OperatorRole $role): bool => in_array($role, $autorises, true)) !== []) {
                $sections[] = $section;
            }
        }

        return $sections;
    }

    private const array MATRICE = [
        self::ORGANISATIONS => [OperatorRole::Admin, OperatorRole::Support, OperatorRole::Compliance, OperatorRole::Billing],
        self::COMPTES => [OperatorRole::Admin, OperatorRole::Support, OperatorRole::Compliance],
        self::ABONNEMENTS => [OperatorRole::Admin, OperatorRole::Billing],
        self::SUPPORT => [OperatorRole::Admin, OperatorRole::Support],
        self::RGPD => [OperatorRole::Admin, OperatorRole::Compliance],
    ];
}
