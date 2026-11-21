<?php

declare(strict_types=1);

namespace Tests\Feature\Owner;

use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as LR;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

final class OwnerReadContext
{
    public static function lotDe(Organization $organisation, Mandate $mandat): Unit
    {
        return L::dans($organisation, fn (): Unit => Unit::query()->findOrFail($mandat->units()->firstOrFail()->unit_id));
    }

    /**
     * Un propriétaire complet (mandat actif et accès vivant) avec le lot de son mandat.
     *
     * @return array{user: User, party: Party, mandate: Mandate, access: OwnerAccess, unit: Unit}
     */
    public static function proprietaire(Organization $organisation, string $email = 'awa@exemple.fr'): array
    {
        $p = O::proprietaire($organisation, $email);

        return [...$p, 'unit' => self::lotDe($organisation, $p['mandate'])];
    }

    /**
     * Bail signé sur le lot, avec un loyer et un locataire joignable (e-mail et téléphone qui ne doivent jamais sortir).
     *
     * @param  array<string, mixed>  $attributs
     * @return array{lease: Lease, tenant: Party}
     */
    public static function bail(Organization $organisation, Unit $lot, array $attributs = [], string $nom = 'Marie Durand', int $loyer = 65000): array
    {
        $bail = LR::bailSigne($organisation, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', ...$attributs]);
        LR::occuper($organisation, $bail, $lot, ['valid_from' => $bail->starts_on->toDateString(), 'is_main' => true]);
        LR::terme($organisation, $bail, 'rent', [...LR::loyer($loyer), 'valid_from' => $bail->starts_on->toDateString()]);
        $locataire = T::partie($organisation, ['display_name' => $nom]);
        T::emailPrincipal($organisation, $locataire, 'locataire.secret@exemple.fr');
        LR::lier($organisation, $bail, $locataire, ['valid_from' => $bail->starts_on->toDateString()]);

        return ['lease' => $bail, 'tenant' => $locataire];
    }

    public static function fichier(Organization $organisation, string $nom = 'diagnostic.pdf', string $contenu = "%PDF-1.4\n% diagnostic\n"): StoredFileData
    {
        return L::dans($organisation, fn (): StoredFileData => app(DocumentStore::class)->store(FileSource::contents($contenu), $nom, FileCategory::Supporting));
    }

    /**
     * Pièce partagée avec le mandant, adossée à un vrai fichier.
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function piece(Organization $organisation, Mandate $mandat, array $attributs = [], string $nom = 'diagnostic.pdf'): MandateDocument
    {
        $fichier = self::fichier($organisation, $nom);

        return L::dans($organisation, fn (): MandateDocument => MandateDocument::factory()->create([
            'mandate_id' => $mandat->id,
            'stored_file_id' => $fichier->id,
            ...$attributs,
        ]));
    }

    public static function lire(mixed $test, ?User $compte, string $chemin): mixed
    {
        return O::comme($test, $compte)->getJson('/api/v1/owner'.$chemin);
    }

    /**
     * Nombre de requêtes SQL d'une lecture réussie.
     */
    public static function requetes(mixed $test, User $compte, string $chemin): int
    {
        O::comme($test, $compte);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $test->getJson('/api/v1/owner'.$chemin)->assertOk();
        $total = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $total;
    }

    /**
     * Toutes les valeurs d'une réponse, pour vérifier qu'un identifiant ou un texte n'y figure nulle part.
     */
    public static function texte(mixed $reponse): string
    {
        return json_encode($reponse->json(), JSON_THROW_ON_ERROR);
    }
}
