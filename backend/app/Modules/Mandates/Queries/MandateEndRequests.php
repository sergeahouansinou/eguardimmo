<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Shared\Tenancy\AcrossOrganizations;

final readonly class MandateEndRequests
{
    /**
     * Suppose un contexte d'organisation.
     */
    public function pendingOf(string $mandateId): ?MandateEndRequest
    {
        return MandateEndRequest::query()->where('mandate_id', $mandateId)->where('status', EndRequestStatus::Pending->value)->first();
    }

    /**
     * Suppose un contexte d'organisation.
     */
    public function latestOf(string $mandateId): ?MandateEndRequest
    {
        return MandateEndRequest::query()->where('mandate_id', $mandateId)->orderByDesc('created_at')->orderByDesc('id')->first();
    }

    /**
     * Suppose un contexte d'organisation et une transaction ouverte.
     */
    public function lockedPendingOf(string $mandateId): ?MandateEndRequest
    {
        return MandateEndRequest::query()->where('mandate_id', $mandateId)->where('status', EndRequestStatus::Pending->value)->lockForUpdate()->first();
    }

    /**
     * Suppose un contexte d'organisation et une transaction ouverte.
     */
    public function lockedLatestOf(string $mandateId): ?MandateEndRequest
    {
        return MandateEndRequest::query()->where('mandate_id', $mandateId)->orderByDesc('id')->lockForUpdate()->first();
    }

    /**
     * Suppose un contexte d'organisation.
     *
     * @param  list<string>  $mandateIds
     * @return list<string>
     */
    public function pendingMandateIds(array $mandateIds): array
    {
        if ($mandateIds === []) {
            return [];
        }

        /** @var list<string> */
        return MandateEndRequest::query()->whereIn('mandate_id', $mandateIds)->where('status', EndRequestStatus::Pending->value)->pluck('mandate_id')->all();
    }

    /**
     * Demandes vivantes de mandats déjà jugés visibles du propriétaire, toutes organisations confondues.
     *
     * @param  list<string>  $mandateIds
     * @return array<string, MandateEndRequest> par mandat
     */
    public function pendingAmong(array $mandateIds): array
    {
        if ($mandateIds === []) {
            return [];
        }

        $parMandat = [];

        foreach (AcrossOrganizations::query(MandateEndRequest::class)->whereIn('mandate_id', $mandateIds)->where('status', EndRequestStatus::Pending->value)->get() as $demande) {
            $parMandat[$demande->mandate_id] = $demande;
        }

        return $parMandat;
    }
}
