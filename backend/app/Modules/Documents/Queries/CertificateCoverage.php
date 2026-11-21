<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Documents\Data\CoverageData;
use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Enums\CoverageState;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Support\CertificateTypes;
use Carbon\CarbonImmutable;

final readonly class CertificateCoverage
{
    public function __construct(
        private TermDirectory $referentiel,
        private CertificateTypes $types,
    ) {}

    public function of(string $subjectType, string $subjectId, CertificateTypeSemantic $sens, CarbonImmutable $today): CoverageState
    {
        return $this->detail($subjectType, $subjectId, $sens, $today)->state;
    }

    /**
     * Même état que `of()`, avec la dernière fin de validité parmi les pièces qui le justifient (null si aucune ou sans échéance).
     */
    public function detail(string $subjectType, string $subjectId, CertificateTypeSemantic $sens, CarbonImmutable $today): CoverageData
    {
        $types = $this->referentiel->bySemanticKey(VocabularyKey::CertificateType, $sens->value);

        if ($types === []) {
            return new CoverageData(CoverageState::Missing, null);
        }

        $pieces = Certificate::query()
            ->where('subject_type', $subjectType)->where('subject_id', $subjectId)
            ->whereIn('certificate_type_term_id', array_map(fn ($terme): string => $terme->id, $types))
            ->whereDoesntHave('replacement')
            ->get();

        $valide = false;
        $aRenouveler = false;
        $fin = null;

        foreach ($pieces as $piece) {
            $etat = CertificateState::at($today, $piece->expires_on, $this->types->reminderDays($this->types->find($piece->certificate_type_term_id)));

            if ($etat === CertificateState::Expired) {
                continue;
            }

            $valide = $valide || $etat === CertificateState::Valid;
            $aRenouveler = $aRenouveler || $etat === CertificateState::ToRenew;

            if ($piece->expires_on !== null && ($fin === null || $piece->expires_on > $fin)) {
                $fin = $piece->expires_on;
            }
        }

        $etat = $valide ? CoverageState::Valid : ($aRenouveler ? CoverageState::Expiring : CoverageState::Missing);

        return new CoverageData($etat, $fin);
    }
}
