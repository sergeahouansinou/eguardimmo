<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Models\LeaseDocument;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class UnshareLeaseDocument
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Le fichier reste stocké ; un retrait déjà fait ne se rejoue pas.
     */
    public function handle(LeaseDocument $document): LeaseDocument
    {
        if ($document->revoked_at !== null) {
            return $document;
        }

        return DB::transaction(function () use ($document): LeaseDocument {
            $document->forceFill(['revoked_at' => now()])->save();
            $this->audit->handle('leases.document.unshared', subject: $document, metadata: ['kind' => $document->kind->value]);

            return $document;
        });
    }
}
