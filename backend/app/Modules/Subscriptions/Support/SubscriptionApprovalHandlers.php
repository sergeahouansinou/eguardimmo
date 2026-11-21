<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Support;

use App\Modules\Subscriptions\Actions\GrantEntitlementOverride;
use App\Modules\Subscriptions\Actions\PublishPlanVersion;
use App\Modules\Subscriptions\Actions\RevokeEntitlementOverride;
use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Enums\OverrideReason;
use App\Modules\Subscriptions\Queries\Plans;
use App\Modules\Subscriptions\Queries\SubscriptionRecords;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Approval\ApprovalSubject;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Publication d'une version de plan et dérogations : soumises à double validation (ADR 0037).
 */
final readonly class SubscriptionApprovalHandlers
{
    public const PUBLISH = 'subscriptions.plan_version.publish';

    public const GRANT = 'subscriptions.override.grant';

    public const REVOKE = 'subscriptions.override.revoke';

    private const DUREE_MAX_JOURS = 366;

    public function __construct(
        private PublishPlanVersion $publication,
        private GrantEntitlementOverride $octroi,
        private RevokeEntitlementOverride $retrait,
        private Plans $plans,
        private SubscriptionRecords $abonnements,
    ) {}

    public function register(ApprovalHandlers $registre): void
    {
        $registre->register(self::PUBLISH, function (string $id): ApprovalSubject {
            $version = $this->plans->version($id);

            if (! $version->isDraft()) {
                throw ErrorCode::PlanVersionNotEditable->problem();
            }

            PlanVersionRules::assertPublishable($version);

            return new ApprovalSubject('plan_version', $version->id, null, ['plan' => $version->plan->code, 'version' => $version->version, 'content_sha256' => PlanVersionDigest::of($version)]);
        }, $this->publication->handle(...));

        $registre->register(self::GRANT, function (string $id, array $charge): ApprovalSubject {
            if ($this->abonnements->forOrganization($id) === null) {
                throw ErrorCode::OverrideInvalid->problem('Cette organisation n\'a pas d\'abonnement.');
            }

            return new ApprovalSubject('organization', strtolower($id), strtolower($id), $this->grantPayload($charge));
        }, $this->octroi->handle(...));

        $registre->register(self::REVOKE, function (string $id): ApprovalSubject {
            $derogation = $this->abonnements->override($id);

            if ($derogation === null || $derogation->revoked_at !== null) {
                throw ErrorCode::OverrideInvalid->problem('Cette dérogation n\'existe pas ou est déjà retirée.');
            }

            return new ApprovalSubject('entitlement_override', $derogation->id, $derogation->organization_id);
        }, $this->retrait->handle(...));
    }

    /**
     * @param  array<string, mixed>  $charge
     * @return array<string, string|int|bool>
     */
    private function grantPayload(array $charge): array
    {
        $erreurs = [];
        $fonction = is_string($charge['feature'] ?? null) ? Feature::tryFrom($charge['feature']) : null;
        $motif = is_string($charge['reason_code'] ?? null) ? OverrideReason::tryFrom($charge['reason_code']) : null;
        $active = in_array($charge['enabled'] ?? null, ['true', 'false', true, false, '1', '0', 1, 0], true) ? filter_var($charge['enabled'], FILTER_VALIDATE_BOOLEAN) : null;
        $fin = is_string($charge['ends_at'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $charge['ends_at']) === 1 ? CarbonImmutable::createFromFormat('Y-m-d', $charge['ends_at']) : null;
        $limite = $charge['limit_value'] ?? null;

        $fonction ?? $erreurs['payload.feature'] = 'La fonction est obligatoire et doit être connue.';
        $motif ?? $erreurs['payload.reason_code'] = 'Le motif est obligatoire : geste commercial, migration, incident ou pilote.';
        $active ?? $erreurs['payload.enabled'] = 'Indiquez si la fonction est activée.';

        if ($fin === null || $fin->endOfDay()->isPast() || $fin->greaterThan(now()->addDays(self::DUREE_MAX_JOURS))) {
            $erreurs['payload.ends_at'] = 'La date de fin est obligatoire, à venir et dans les 12 mois.';
        }

        if ($limite !== null && $limite !== '' && (! is_numeric($limite) || (int) $limite < 0 || ($fonction !== null && ! $fonction->isQuota()))) {
            $erreurs['payload.limit_value'] = 'La limite doit être un entier positif, réservé aux quotas.';
        }

        if ($erreurs !== [] || $fonction === null || $motif === null || $active === null || ! $fin instanceof CarbonImmutable) {
            throw ValidationException::withMessages($erreurs === [] ? ['payload' => 'Dérogation invalide.'] : $erreurs);
        }

        $normalisee = ['feature' => $fonction->value, 'enabled' => $active, 'ends_at' => $fin->toDateString(), 'reason_code' => $motif->value];

        return $limite === null || $limite === '' ? $normalisee : [...$normalisee, 'limit_value' => (int) $limite];
    }
}
