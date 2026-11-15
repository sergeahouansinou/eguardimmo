<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\NewCertificateData;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\CertificateDataSchema;
use App\Modules\Documents\Support\CertificateTypes;
use App\Modules\Documents\Support\SubjectGuard;
use Illuminate\Support\Facades\DB;

final readonly class CreateCertificate
{
    public function __construct(
        private SubjectGuard $sujets,
        private CertificateTypes $types,
    ) {}

    public function handle(NewCertificateData $data): Certificate
    {
        $this->sujets->ensure($data->subject);
        $type = $this->types->assignable($data->certificateTypeTermId);
        $valeurs = CertificateDataSchema::validate($this->types->dataSchema($type), $data->data);
        $mois = $this->types->defaultValidityMonths($type);
        $echeance = $data->expiresOn ?? ($mois === null ? null : $data->issuedOn->addMonthsNoOverflow($mois));

        if ($data->storedFileId !== null && ! StoredFile::query()->whereKey($data->storedFileId)->exists()) {
            throw ErrorCode::FileNotFound->problem();
        }

        return DB::transaction(fn (): Certificate => Certificate::query()->create([
            'subject_type' => $data->subject->type,
            'subject_id' => $data->subject->id,
            'certificate_type_term_id' => $type->id,
            'reference' => $data->reference,
            'issuer_party_id' => $data->issuerPartyId,
            'issued_on' => $data->issuedOn,
            'expires_on' => $echeance,
            'data' => $valeurs,
            'stored_file_id' => $data->storedFileId,
            'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
        ]));
    }
}
