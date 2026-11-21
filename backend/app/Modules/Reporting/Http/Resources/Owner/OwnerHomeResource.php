<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources\Owner;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Accueil du mandant pour une agence : aucun total ne traverse deux agences ni deux devises. Le locataire n'y figure que par son nom ;
 * le retard est un montant, un nombre d'échéances et un nombre de jours, jamais l'identité du payeur ni un moyen de paiement.
 *
 * @property array<string, mixed> $resource
 */
final class OwnerHomeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;
        $devise = (string) $d['currency'];
        $montant = fn (?int $valeur): ?array => $valeur === null ? null : ['amount' => $valeur, 'currency' => $devise];
        $mois = $d['month'];
        $versements = $d['payouts'];

        return [
            'agency' => $d['agency'],
            'mandant' => $d['mandant'],
            'access' => $d['access'],
            'currency' => $devise,
            'mandate' => $d['mandate'],
            'mandates_count' => $d['mandates_count'],
            'month' => [
                'period' => $mois['period'],
                'from' => $mois['from'],
                'to' => $mois['to'],
                'called' => $montant($mois['called']),
                'collected' => $montant($mois['collected']),
                'arrears' => [
                    'amount' => $montant($mois['arrears']['amount']),
                    'count' => $mois['arrears']['count'],
                    'max_days_late' => $mois['arrears']['max_days_late'],
                ],
            ],
            'payouts' => $versements === null ? null : [
                'pending' => $versements['pending'] === null ? null : ['net' => $montant($versements['pending']['net']), 'fees' => $montant($versements['pending']['fees'])],
                'last' => $versements['last'] === null ? null : ['amount' => $montant($versements['last']['amount']), 'date' => $versements['last']['date'], 'number' => $versements['last']['number']],
                'next_date' => $versements['next_date'],
                'next_notice' => $versements['next_notice'],
            ],
            'last_report' => $d['last_report'],
            'counters' => $d['counters'],
            'units' => array_map(fn (array $u): array => [
                ...$u,
                'rent' => $montant($u['rent']),
                'collected' => $montant($u['collected']),
            ], $d['units']),
        ];
    }
}
