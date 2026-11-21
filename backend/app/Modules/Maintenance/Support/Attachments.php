<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionFile;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Dépôt d'une pièce sur une intervention : le type est lu sur le contenu (jamais sur l'extension ni le type annoncé), le
 * stockage et le renommage sont ceux de Documents, la conservation dépend de la nature de la pièce (ADR 0029).
 */
final readonly class Attachments
{
    private const IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

    public function __construct(
        private DocumentStore $documents,
        private Timeline $chronologie,
    ) {}

    public function attach(Intervention $intervention, UploadedFile $fichier, FileKind $kind, ActorKind $acteur, bool $visibleLocataire, bool $visibleMandant = false): InterventionFile
    {
        $chemin = $fichier->getRealPath();
        $type = $chemin === false ? null : (new \finfo(FILEINFO_MIME_TYPE))->file($chemin);

        if ($chemin === false || ! is_string($type) || ! $this->allowed($kind, $type)) {
            throw ErrorCode::FileInvalid->problem();
        }

        $this->assertRoom($intervention, $acteur);
        $comptable = in_array($kind, [FileKind::Quote, FileKind::Invoice, FileKind::Proof], true);
        $annees = $comptable ? Settings::accountingRetentionYears() : Settings::tenantMediaRetentionYears();
        $stocke = $this->documents->store(
            FileSource::path($chemin),
            Str::limit(basename($fichier->getClientOriginalName()), 120, ''),
            FileCategory::Supporting,
            new DocumentSubject('intervention', $intervention->id),
            CarbonImmutable::today()->addYears($annees),
        );

        $ligne = InterventionFile::query()->create([
            'intervention_id' => $intervention->id,
            'stored_file_id' => $stocke->id,
            'kind' => $kind,
            'uploaded_by_kind' => $acteur,
            'uploaded_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            'visible_to_owner' => $visibleMandant,
            'visible_to_tenant' => $visibleLocataire && ! $comptable,
        ]);

        $this->chronologie->add($intervention, EventKind::FileAdded, $acteur, $comptable ? 'Une pièce a été ajoutée.' : 'Une photo a été ajoutée.', locataire: $ligne->visible_to_tenant);

        return $ligne;
    }

    /**
     * Pièce déjà déposée sur cette intervention (devis, facture, preuve), jamais celle d'une autre intervention.
     */
    public function resolve(string $fileId, string $interventionId, FileKind ...$kinds): InterventionFile
    {
        $ligne = Str::isUuid($fileId) ? InterventionFile::query()->whereKey($fileId)->where('intervention_id', $interventionId)->first() : null;

        if ($ligne === null) {
            throw ErrorCode::FileNotFound->problem();
        }

        if (! in_array($ligne->kind, $kinds, true)) {
            throw ErrorCode::FileInvalid->problem();
        }

        return $ligne;
    }

    private function assertRoom(Intervention $intervention, ActorKind $acteur): void
    {
        $total = InterventionFile::query()->where('intervention_id', $intervention->id)->count();

        if ($total >= Settings::filesPerIntervention()) {
            throw ErrorCode::FilesLimit->problem();
        }

        if ($acteur === ActorKind::Tenant) {
            $photos = InterventionFile::query()->where('intervention_id', $intervention->id)->where('uploaded_by_kind', ActorKind::Tenant->value)->count();

            if ($photos >= Settings::photosPerReport()) {
                throw ErrorCode::FilesLimit->problem();
            }
        }
    }

    private function allowed(FileKind $kind, string $type): bool
    {
        return match ($kind) {
            FileKind::PhotoBefore, FileKind::PhotoAfter => in_array($type, self::IMAGES, true),
            FileKind::Quote, FileKind::Invoice => $type === 'application/pdf',
            FileKind::Proof, FileKind::Report, FileKind::Other => $type === 'application/pdf' || in_array($type, self::IMAGES, true),
        };
    }
}
