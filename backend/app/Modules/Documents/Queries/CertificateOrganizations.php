<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Documents\Models\Certificate;
use App\Shared\Tenancy\AcrossOrganizations;

final class CertificateOrganizations
{
    /**
     * Organisations qui portent au moins une pièce à échéance : le balayage quotidien les parcourt une à une.
     *
     * @return list<string>
     */
    public function withDeadlines(): array
    {
        return array_values(AcrossOrganizations::query(Certificate::class)
            ->whereNotNull('expires_on')
            ->distinct()
            ->pluck('organization_id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());
    }
}
