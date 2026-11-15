<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\CustomFieldChangesData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Support\CustomFieldShape;
use Illuminate\Support\Facades\DB;

final readonly class UpdateCustomField
{
    public function handle(CustomFieldDefinition $champ, CustomFieldChangesData $changements): CustomFieldDefinition
    {
        $type = $changements->type ?? $champ->type;
        $typeChange = $type !== $champ->type;
        $vocabulaire = $typeChange || $changements->vocabulary !== null ? $changements->vocabulary?->value : $champ->vocabulary;
        $options = $typeChange || $changements->options !== null ? $changements->options : $champ->options;

        CustomFieldShape::assert($type, $vocabulaire, $options);

        if ($champ->values_recorded_at !== null && ($typeChange || $vocabulaire !== $champ->vocabulary || $this->retireDesOptions($champ, $options))) {
            throw ErrorCode::CustomFieldTypeLocked->problem();
        }

        return DB::transaction(function () use ($champ, $changements, $type, $vocabulaire, $options): CustomFieldDefinition {
            $champ->type = $type;
            $champ->vocabulary = $vocabulaire;
            $champ->options = $options;
            $champ->labels = $changements->labels ?? $champ->labels;
            $champ->required = $changements->required ?? $champ->required;
            $champ->position = $changements->position ?? $champ->position;
            $champ->save();

            return $champ;
        });
    }

    /**
     * @param  list<array{key: string, labels: array<string, string>}>|null  $options
     */
    private function retireDesOptions(CustomFieldDefinition $champ, ?array $options): bool
    {
        $conservees = array_map(fn (array $option): string => $option['key'], $options ?? []);

        return array_diff($champ->optionKeys(), $conservees) !== [];
    }
}
