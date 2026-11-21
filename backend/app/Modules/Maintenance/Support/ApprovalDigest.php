<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\InterventionQuoteLine;

/**
 * Empreinte de ce que le mandant voit avant de décider : la demande et son devis. Le client la renvoie, une empreinte qui diffère
 * de celle du serveur refuse la décision (409 `approval_stale`). Les dates de la demande n'y entrent pas : seul le contenu engage.
 */
final class ApprovalDigest
{
    public static function of(InterventionApproval $demande, ?InterventionQuote $devis): string
    {
        return hash('sha256', self::canonical([
            'approval' => $demande->id,
            'intervention' => $demande->intervention_id,
            'amount' => (int) $demande->amount->getAmount(),
            'ceiling' => (int) $demande->ceiling_amount->getAmount(),
            'currency' => $demande->currency,
            'quote' => $devis === null ? null : [
                'id' => $devis->id,
                'reference' => $devis->reference,
                'kind' => $devis->kind->value,
                'supplier' => $devis->supplier_party_id,
                'issued_on' => $devis->issued_on->toDateString(),
                'valid_until' => $devis->valid_until?->toDateString(),
                'file' => $devis->stored_file_id,
                'net' => (int) $devis->total_net->getAmount(),
                'tax' => (int) $devis->total_tax->getAmount(),
                'gross' => (int) $devis->total_gross->getAmount(),
                'lines' => $devis->lines->map(fn (InterventionQuoteLine $l): array => [
                    'position' => $l->position,
                    'label' => $l->label,
                    'quantity_milli' => $l->quantity_milli,
                    'unit' => $l->unit,
                    'unit_price' => $l->unit_price,
                    'net' => $l->net_amount,
                    'tax_rate_pcm' => $l->tax_rate_pcm,
                ])->values()->all(),
            ],
        ]));
    }

    /**
     * JSON canonique : clés triées à tous les niveaux, aucun échappement variable.
     *
     * @param  array<string, mixed>  $valeurs
     */
    public static function canonical(array $valeurs): string
    {
        return json_encode(self::sorted($valeurs), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private static function sorted(mixed $valeur): mixed
    {
        if (! is_array($valeur)) {
            return $valeur;
        }

        $trie = array_map(self::sorted(...), $valeur);

        if (! array_is_list($trie)) {
            ksort($trie);
        }

        return $trie;
    }
}
