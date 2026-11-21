<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Documents\Actions\CreateCertificate;
use App\Modules\Documents\Data\CoverageData;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\NewCertificateData;
use App\Modules\Documents\Enums\CoverageState;
use App\Modules\Documents\Enums\SubjectType;
use App\Modules\Documents\Queries\CertificateCoverage;
use Carbon\CarbonImmutable;
use RuntimeException;

/**
 * État et enregistrement des pièces à échéance pour les modules qui conditionnent une décision à une pièce ; suppose un contexte d'organisation.
 */
final readonly class Certificates
{
    public function __construct(
        private CertificateCoverage $couverture,
        private CreateCertificate $creation,
        private TermDirectory $referentiel,
    ) {}

    /**
     * `valid`, `expiring` (rappel ouvert, pièce encore valable) ou `missing` (aucune pièce valable). Une pièce remplacée ne compte pas.
     */
    public function partyCoverage(string $partyId, CertificateTypeSemantic $sens, CarbonImmutable $today): CoverageState
    {
        return $this->couverture->of('party', $partyId, $sens, $today);
    }

    /**
     * Couverture d'un bail, avec la dernière fin de validité connue.
     */
    public function leaseCoverage(string $leaseId, CertificateTypeSemantic $sens, CarbonImmutable $today): CoverageData
    {
        return $this->couverture->detail(SubjectType::Lease->value, $leaseId, $sens, $today);
    }

    /**
     * Enregistre une pièce du type portant ce sens, à rattacher à l'objet ; à appeler dans la transaction de l'appelant. Retourne son identifiant.
     * L'échéance par défaut est celle du type.
     */
    public function record(DocumentSubject $subject, CertificateTypeSemantic $sens, CarbonImmutable $issuedOn, ?CarbonImmutable $expiresOn, ?string $storedFileId): string
    {
        $type = $this->referentiel->bySemanticKey(VocabularyKey::CertificateType, $sens->value)[0] ?? throw new RuntimeException("Aucun type de pièce ne porte le sens {$sens->value} : référentiel non semé.");

        return $this->creation->handle(new NewCertificateData($subject, $type->id, null, null, $issuedOn, $expiresOn, [], $storedFileId))->id;
    }
}
