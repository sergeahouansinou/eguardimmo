<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Properties\Data\OwnershipAnomalyData;
use App\Modules\Properties\Enums\AnomalyKind;
use App\Modules\Properties\Support\OwnershipLoad;
use Illuminate\Support\Facades\DB;

/**
 * Lecture de toutes les organisations en SQL : contrôle de plateforme, sans contexte d'organisation.
 */
final class OwnershipAnomalies
{
    /**
     * @return list<OwnershipAnomalyData>
     */
    public function find(): array
    {
        $anomalies = [];
        $groupe = [];
        $courant = null;

        $lignes = DB::table('unit_ownerships')
            ->select('organization_id', 'unit_id', 'nature', 'share_bp', 'valid_from', 'valid_to')
            ->orderBy('unit_id')
            ->orderBy('nature')
            ->orderBy('valid_from')
            ->cursor();

        foreach ($lignes as $ligne) {
            $cle = $ligne->unit_id.'|'.$ligne->nature;

            if ($courant !== null && $cle !== $courant['cle']) {
                $this->peak($anomalies, $courant, $groupe);
                $groupe = [];
            }

            $courant = ['cle' => $cle, 'organization' => (string) $ligne->organization_id, 'unit' => (string) $ligne->unit_id, 'nature' => (string) $ligne->nature];
            $debut = substr((string) $ligne->valid_from, 0, 10);
            $fin = $ligne->valid_to === null ? null : substr((string) $ligne->valid_to, 0, 10);

            if ($ligne->share_bp < 1 || $ligne->share_bp > OwnershipLoad::CAP) {
                $anomalies[] = new OwnershipAnomalyData(AnomalyKind::InvalidShare, $courant['organization'], $courant['unit'],
                    "Quote-part de {$ligne->share_bp} points de base hors de 1 à ".OwnershipLoad::CAP.'.');
            }

            if ($fin !== null && $fin <= $debut) {
                $anomalies[] = new OwnershipAnomalyData(AnomalyKind::InvalidPeriod, $courant['organization'], $courant['unit'],
                    "La période {$debut} → {$fin} est vide ou inversée.");
            }

            $groupe[] = ['from' => $debut, 'to' => $fin, 'share' => (int) $ligne->share_bp];
        }

        if ($courant !== null) {
            $this->peak($anomalies, $courant, $groupe);
        }

        return $anomalies;
    }

    /**
     * @param  list<OwnershipAnomalyData>  $anomalies
     * @param  array{cle: string, organization: string, unit: string, nature: string}  $groupe
     * @param  list<array{from: string, to: string|null, share: int}>  $lignes
     */
    private function peak(array &$anomalies, array $groupe, array $lignes): void
    {
        $pic = OwnershipLoad::peak($lignes);

        if ($pic > OwnershipLoad::CAP) {
            $anomalies[] = new OwnershipAnomalyData(AnomalyKind::ShareExceeded, $groupe['organization'], $groupe['unit'],
                "Droit « {$groupe['nature']} » : jusqu'à {$pic} points de base en vigueur en même temps pour ".OwnershipLoad::CAP.' au maximum.');
        }
    }
}
