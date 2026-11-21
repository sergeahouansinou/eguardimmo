<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Models\PropertyContact;
use Illuminate\Support\Facades\DB;

final readonly class RemovePropertyContact
{
    /**
     * Retire le lien seulement : la fiche du contact et son historique restent ; la suppression est auditée.
     */
    public function handle(PropertyContact $lien): void
    {
        DB::transaction(function () use ($lien): void {
            $lien->delete();
        });
    }
}
