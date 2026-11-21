<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case PlanNotFound = 'plan_not_found';
    case PlanVersionNotEditable = 'plan_version_not_editable';
    case PlanDraftExists = 'plan_draft_exists';
    case FeatureNotInPlan = 'feature_not_in_plan';
    case PlanQuotaReached = 'plan_quota_reached';
    case OverrideInvalid = 'override_invalid';
    case PlanVersionInvalid = 'plan_version_invalid';
    case SubscriptionNotFound = 'subscription_not_found';
    case PlanVersionPublicationPending = 'plan_version_publication_pending';

    /**
     * @param  array<string, mixed>  $extensions  membres ajoutés au corps de la réponse
     */
    public function problem(?string $detail = null, array $extensions = []): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail(), extensions: $extensions);
    }

    public function status(): int
    {
        return match ($this) {
            self::PlanNotFound, self::SubscriptionNotFound => 404,
            self::FeatureNotInPlan => 403,
            self::PlanVersionNotEditable, self::PlanDraftExists, self::PlanQuotaReached, self::PlanVersionPublicationPending => 409,
            self::OverrideInvalid, self::PlanVersionInvalid => 422,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::PlanNotFound => 'Plan introuvable',
            self::PlanVersionNotEditable => 'Version de plan figée',
            self::PlanDraftExists => 'Brouillon déjà ouvert',
            self::FeatureNotInPlan => 'Fonction absente de votre plan',
            self::PlanQuotaReached => 'Limite de votre plan atteinte',
            self::OverrideInvalid => 'Dérogation invalide',
            self::PlanVersionInvalid => 'Version de plan incomplète',
            self::SubscriptionNotFound => 'Abonnement introuvable',
            self::PlanVersionPublicationPending => 'Publication en attente',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::PlanNotFound => 'Ce plan ou cette version n\'existe pas.',
            self::PlanVersionNotEditable => 'Seule une version en brouillon se modifie.',
            self::PlanDraftExists => 'Ce plan a déjà un brouillon : modifiez-le ou publiez-le d\'abord.',
            self::FeatureNotInPlan => 'Cette fonction n\'est pas incluse dans votre plan.',
            self::PlanQuotaReached => 'Vous avez atteint la limite de votre plan : passez à un plan supérieur pour continuer à créer. Vos données restent consultables et exportables.',
            self::OverrideInvalid => 'Cette dérogation n\'est pas valable.',
            self::PlanVersionInvalid => 'Cette version ne peut pas être publiée en l\'état.',
            self::SubscriptionNotFound => 'Cette organisation n\'a pas d\'abonnement.',
            self::PlanVersionPublicationPending => 'Une demande de publication est en attente pour cette version : elle doit être traitée ou annulée avant toute modification.',
        };
    }
}
