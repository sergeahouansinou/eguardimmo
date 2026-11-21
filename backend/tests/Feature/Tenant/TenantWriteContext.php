<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;

final class TenantWriteContext
{
    public const string PDF = "%PDF-1.4\n% piece\n";

    /**
     * Agence, locataire du bail signé et équipe (titulaire, gestionnaire, comptable), temps figé.
     *
     * @return array{org: Organization, moi: array<string, mixed>, owner: User, manager: User, accountant: User}
     */
    public static function monde(mixed $test): array
    {
        Storage::fake('documents');
        L::semer();
        $test->travelTo(CarbonImmutable::parse(TenantContext::AUJOURDHUI));
        $org = TenantContext::organisation();

        return [
            'org' => $org,
            'moi' => TenantContext::locataire($org),
            'owner' => L::titulaire($org),
            'manager' => L::membre($org, MemberRole::Manager),
            'accountant' => L::membre($org, MemberRole::Accountant),
        ];
    }

    public static function fichier(Organization $organisation, string $nom = 'piece.pdf', string $contenu = self::PDF, ?DocumentSubject $sujet = null, FileCategory $categorie = FileCategory::Supporting): StoredFileData
    {
        return L::dans($organisation, fn (): StoredFileData => app(DocumentStore::class)->store(FileSource::contents($contenu), $nom, $categorie, $sujet));
    }

    public static function fichierDuBail(Organization $organisation, string $bail, string $nom = 'piece.pdf'): StoredFileData
    {
        return self::fichier($organisation, $nom, self::PDF, new DocumentSubject('lease', $bail));
    }

    public static function pdf(string $nom = 'attestation.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($nom, self::PDF);
    }

    public static function requetes(callable $appel): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $appel();
        $total = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $total;
    }

    /**
     * @return list<string> actions d'audit enregistrées
     */
    public static function actions(): array
    {
        return DB::table('audit_logs')->orderBy('id')->pluck('action')->all();
    }
}
