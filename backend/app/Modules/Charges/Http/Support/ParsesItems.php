<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Support;

use App\Modules\Charges\Data\ItemInputData;
use App\Modules\Charges\Data\SourceInputData;
use App\Modules\Charges\Enums\SourceKind;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

trait ParsesItems
{
    private const int SOURCES_MAX_PAR_REQUETE = 500;

    /**
     * @return array<string, list<mixed>>
     */
    protected function itemRules(): array
    {
        return [
            'items' => ['array', 'max:100'],
            'items.*.label' => ['required', 'string', 'min:1', 'max:120'],
            'items.*.rubric' => ['required', 'string', 'max:64'],
            'items.*.key_id' => ['nullable', 'uuid'],
            'items.*.unit_id' => ['nullable', 'uuid'],
            'items.*.sources' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.sources.*.kind' => ['required', Rule::enum(SourceKind::class)],
            'items.*.sources.*.id' => ['required', 'uuid'],
            'items.*.sources.*.amount' => ['nullable', 'integer', 'min:1', 'max:999999999999'],
            'items.*.consumptions' => ['nullable', 'array', 'max:500'],
            'items.*.consumptions.*.unit_id' => ['required', 'uuid', 'distinct'],
            'items.*.consumptions.*.quantity_milli' => ['required', 'integer', 'min:1', 'max:999999999999'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validateur): void {
            $total = 0;

            foreach ((array) $this->input('items', []) as $poste) {
                $total += is_array($poste) ? count((array) ($poste['sources'] ?? [])) : 0;
            }

            if ($total > self::SOURCES_MAX_PAR_REQUETE) {
                $validateur->errors()->add('items', sprintf('Une requête porte au plus %d sources au total (%d reçues) : scindez les postes sur plusieurs enregistrements.', self::SOURCES_MAX_PAR_REQUETE, $total));
            }
        }];
    }

    /**
     * @return list<ItemInputData>
     */
    public function items(): array
    {
        $postes = [];

        foreach ((array) ($this->validated()['items'] ?? []) as $p) {
            $sources = [];
            foreach ($p['sources'] as $s) {
                $sources[] = new SourceInputData(SourceKind::from((string) $s['kind']), (string) $s['id'], isset($s['amount']) ? (int) $s['amount'] : null);
            }

            $consommations = [];
            foreach ((array) ($p['consumptions'] ?? []) as $c) {
                $consommations[(string) $c['unit_id']] = (int) $c['quantity_milli'];
            }

            $postes[] = new ItemInputData((string) $p['label'], (string) $p['rubric'], isset($p['key_id']) ? (string) $p['key_id'] : null, isset($p['unit_id']) ? (string) $p['unit_id'] : null, $sources, $consommations);
        }

        return $postes;
    }
}
