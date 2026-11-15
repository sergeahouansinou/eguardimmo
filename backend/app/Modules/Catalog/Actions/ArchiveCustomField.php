<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Models\CustomFieldDefinition;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveCustomField
{
    public function handle(CustomFieldDefinition $champ, bool $archived): CustomFieldDefinition
    {
        return DB::transaction(function () use ($champ, $archived): CustomFieldDefinition {
            if ($archived !== ($champ->archived_at !== null)) {
                $champ->archived_at = $archived ? now() : null;
                $champ->save();
            }

            return $champ;
        });
    }
}
