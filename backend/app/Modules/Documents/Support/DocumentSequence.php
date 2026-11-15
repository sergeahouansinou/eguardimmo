<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class DocumentSequence
{
    public function __construct(private CurrentOrganization $organisation) {}

    /**
     * Séquence continue par organisation et par type ; à appeler dans la transaction qui écrit la pièce, le verrou y reste tenu.
     */
    public function next(IssuedDocumentType $type): int
    {
        $organisation = $this->organisation->id();
        $cle = ['organization_id' => $organisation, 'type' => $type->value];

        DB::table('document_sequences')->insertOrIgnore([...$cle, 'last_value' => 0]);
        $valeur = (int) DB::table('document_sequences')->where($cle)->lockForUpdate()->value('last_value') + 1;
        DB::table('document_sequences')->where($cle)->update(['last_value' => $valeur]);

        return $valeur;
    }
}
