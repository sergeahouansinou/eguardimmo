<?php

declare(strict_types=1);

namespace Tests\Feature\Maintenance;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\SupplierProfile;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Money\Currency;
use Money\Money;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Invoicing\InvoicingContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Mandates\MandatesContext as M;

final class MaintenanceContext
{
    public const string AUJOURDHUI = '2026-11-18 10:00:00';

    public const string BASE = '/api/v1';

    public static function preparer(object $test): void
    {
        L::semer();
        Storage::fake('documents');
        Mail::fake();
        $test->travelTo(CarbonImmutable::parse(self::AUJOURDHUI));
    }

    /**
     * Agence : un lot sous mandat actif (plafond de travaux 500,00), un bail signé, un locataire rattaché, un prestataire actif.
     *
     * @return array{org: Organization, owner: User, unit: Unit, mandant: Party, mandate: Mandate, lease: Lease, tenant: User, tenantParty: Party, supplier: Party}
     */
    public static function agence(int $plafond = 50000): array
    {
        $org = L::organisation();
        $lot = L::lot($org);
        $mandant = L::partie($org);
        $mandat = M::actif($org, $lot, $mandant);
        L::dans($org, fn () => $mandat->terms()->update(['works_limit_amount' => $plafond]));

        return [...self::locataire($org, $lot), 'org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'mandant' => $mandant, 'mandate' => $mandat, 'supplier' => self::prestataire($org)];
    }

    /**
     * Bailleur autonome : pas de mandat, il décide seul.
     *
     * @return array{org: Organization, owner: User, unit: Unit, lease: Lease, tenant: User, tenantParty: Party, supplier: Party}
     */
    public static function autonome(): array
    {
        $org = InvoicingContext::organisation(OrganizationKind::Individual, false, 'Mme Martin');
        $lot = L::lot($org);

        return [...self::locataire($org, $lot), 'org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'supplier' => self::prestataire($org)];
    }

    /**
     * @return array{lease: Lease, tenant: User, tenantParty: Party}
     */
    public static function locataire(Organization $org, Unit $lot): array
    {
        $compte = User::factory()->create();
        $partie = L::dans($org, fn (): Party => Party::factory()->create(['user_id' => $compte->id]));
        $bail = R::bailSigne($org, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
        R::occuper($org, $bail, $lot, ['valid_from' => '2026-01-01', 'is_main' => true]);
        R::terme($org, $bail, 'rent', [...R::loyer(65000), 'valid_from' => '2026-01-01']);
        R::lier($org, $bail, $partie, ['valid_from' => '2026-01-01']);

        return ['lease' => $bail, 'tenant' => $compte, 'tenantParty' => $partie];
    }

    /**
     * Autre locataire de la même organisation, sur un autre lot et un autre bail.
     *
     * @return array{lease: Lease, tenant: User, tenantParty: Party}
     */
    public static function voisin(Organization $org): array
    {
        return self::locataire($org, L::lot($org));
    }

    /**
     * Colocataire : un second compte lié au même bail.
     */
    public static function colocataire(Organization $org, Lease $bail): User
    {
        $compte = User::factory()->create();
        $partie = L::dans($org, fn (): Party => Party::factory()->create(['user_id' => $compte->id]));
        R::lier($org, $bail, $partie, ['valid_from' => '2026-01-01']);

        return $compte;
    }

    public static function prestataire(Organization $org): Party
    {
        return InvoicingContext::entreprise($org);
    }

    public static function assurer(Organization $org, Party $prestataire, string $echeance = '2027-06-30'): void
    {
        L::dans($org, fn (): Certificate => Certificate::query()->create([
            'subject_type' => 'party',
            'subject_id' => $prestataire->id,
            'certificate_type_term_id' => DocumentsContext::type('professional_liability'),
            'issued_on' => '2026-06-30',
            'expires_on' => $echeance,
            'data' => [],
        ]));
    }

    /**
     * Intervention créée par l'équipe, qualifiée, prestataire désigné : prête à recevoir des devis (version 3).
     *
     * @param  array<string, mixed>  $scene
     * @param  array<string, mixed>  $qualification
     */
    public static function enDevis(object $test, array $scene, int $estime = 20000, array $qualification = [], string $nature = 'plumbing'): string
    {
        self::assurer($scene['org'], $scene['supplier']);
        self::comme($test, $scene['owner']);
        if (! SupplierProfile::query()->withoutGlobalScopes()->where('party_id', $scene['supplier']->id)->exists()) {
            $test->postJson(self::url($scene['org'], '/suppliers'), ['party_id' => $scene['supplier']->id])->assertCreated();
        }
        $id = (string) $test->postJson(self::url($scene['org'], '/interventions'), [
            'unit_id' => $scene['unit']->id,
            'nature_term_id' => self::nature($nature),
            'title' => 'Fuite sous l\'évier',
            'description' => 'De l\'eau coule sous l\'évier.',
        ], ['Idempotency-Key' => 'equipe-'.bin2hex(random_bytes(6))])->assertCreated()->json('data.id');
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner', 'estimated_amount' => $estime, ...$qualification])->assertOk();
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/assign"), ['lock_version' => 2, 'supplier_party_id' => $scene['supplier']->id])->assertOk();

        return $id;
    }

    /**
     * Demande du locataire, qualification, prestataire assuré, devis accepté, visite confirmée, travaux terminés (TTC = prix + 20 %).
     *
     * @param  array<string, mixed>  $scene
     */
    public static function travauxTermines(object $test, array $scene, int $prix = 20000, string $nature = 'plumbing'): string
    {
        $reponse = self::signaler($test, $scene, ['nature_term_id' => self::nature($nature)])->assertCreated();
        $id = (string) $reponse->json('data.id');

        self::assurer($scene['org'], $scene['supplier']);
        self::comme($test, $scene['owner']);
        $test->postJson(self::url($scene['org'], '/suppliers'), ['party_id' => $scene['supplier']->id])->assertCreated();
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner', 'estimated_amount' => $prix])->assertOk();
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/assign"), ['lock_version' => 2, 'supplier_party_id' => $scene['supplier']->id])->assertOk();
        $devis = self::devis($test, $scene, $id, $prix)->assertCreated()->json('data.id');
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk()->assertJsonPath('data.status', 'approved');

        $visite = $test->postJson(self::url($scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'presence_required' => true, 'contact_name' => 'Plomberie Dupont'])->assertCreated()->json('data.id');
        self::comme($test, $scene['tenant']);
        $test->postJson(self::BASE."/tenant/interventions/{$id}/visits/{$visite}/confirm")->assertOk()->assertJsonPath('data.state', 'in_progress');
        self::comme($test, $scene['owner']);
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/visits/{$visite}/done"))->assertOk();
        $test->travelTo(now()->addDays(3));
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/complete"), ['lock_version' => Intervention::query()->withoutGlobalScopes()->findOrFail($id)->lock_version, 'completed_on' => '2026-11-20', 'note' => 'Siphon remplacé.'])->assertOk()->assertJsonPath('data.status', 'completed');

        return $id;
    }

    /**
     * Qualifie une intervention déjà signalée, désigne le prestataire assuré (version 3).
     *
     * @param  array<string, mixed>  $scene
     */
    public static function enDevisPour(object $test, array $scene, string $id): void
    {
        self::assurer($scene['org'], $scene['supplier']);
        self::comme($test, $scene['owner']);
        $test->postJson(self::url($scene['org'], '/suppliers'), ['party_id' => $scene['supplier']->id])->assertCreated();
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner', 'estimated_amount' => 20000])->assertOk();
        $test->postJson(self::url($scene['org'], "/interventions/{$id}/assign"), ['lock_version' => 2, 'supplier_party_id' => $scene['supplier']->id])->assertOk();
    }

    /**
     * Facture reçue par l'équipe (TTC 240,00 par défaut : 200,00 HT + TVA 20 %).
     *
     * @param  array<string, mixed>  $scene
     * @param  array<string, mixed>  $surcharges
     */
    public static function facture(object $test, array $scene, string $intervention, array $surcharges = [], ?string $fichier = null): TestResponse
    {
        self::comme($test, $scene['owner']);

        return $test->postJson(self::url($scene['org'], "/interventions/{$intervention}/invoices"), [
            'number' => 'F-'.bin2hex(random_bytes(3)),
            'invoice_on' => '2026-11-20',
            'file_id' => $fichier ?? self::fichier($test, $scene, $intervention, 'invoice'),
            'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4000]],
            'idempotency_key' => 'facture-'.bin2hex(random_bytes(4)),
            ...$surcharges,
        ]);
    }

    public static function resilier(Organization $org, Lease $bail): void
    {
        L::dans($org, fn () => Lease::query()->whereKey($bail->id)->update(['status' => LeaseStatus::Terminated->value]));
    }

    public static function deposer(Organization $org, Lease $bail, int $montant): void
    {
        $somme = new Money($montant, new Currency('EUR'));
        L::dans($org, fn () => app(Ledger::class)->post(new EntryData(Journal::Deposits, CarbonImmutable::today(), 'Dépôt de garantie reçu', SourceType::Deposit, (string) Str::uuid7(), 'test-depot-'.$bail->id, [
            LineData::debit(AccountRole::Bank, $somme, $bail->id),
            LineData::credit(AccountRole::SecurityDeposits, $somme, $bail->id),
        ])));
    }

    public static function comme(object $test, ?User $compte): object
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);

        return $compte === null ? $test : $test->actingAs($compte);
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return self::BASE.'/org/'.$org->id.$chemin;
    }

    public static function nature(string $cle = 'plumbing'): string
    {
        return L::terme('intervention_nature', $cle)->id;
    }

    public static function taux(string $cle = 'fr_vat_normal'): string
    {
        return $cle;
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function signaler(object $test, array $scene, array $surcharges = [], ?string $cle = null): TestResponse
    {
        self::comme($test, $scene['tenant']);

        return $test->postJson(self::BASE.'/tenant/interventions', [
            'lease_id' => $scene['lease']->id,
            'unit_id' => $scene['unit']->id,
            'nature_term_id' => self::nature(),
            'title' => 'Fuite sous l\'évier',
            'description' => 'De l\'eau coule sous l\'évier de la cuisine.',
            'reported_urgency' => 'soon',
            ...$surcharges,
        ], ['Idempotency-Key' => $cle ?? 'signal-'.bin2hex(random_bytes(6))]);
    }

    /**
     * JPEG de 32 pixels portant un segment EXIF (position et appareil) que le stockage doit retirer.
     */
    public static function photo(): UploadedFile
    {
        $image = imagecreatetruecolor(32, 32);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 40, 40));
        $chemin = tempnam(sys_get_temp_dir(), 'ph').'.jpg';
        imagejpeg($image, $chemin);
        $octets = (string) file_get_contents($chemin);
        $exif = "Exif\0\0".'GPSLatitude=48.8566;Make=SecretCam';
        $segment = "\xFF\xE1".pack('n', strlen($exif) + 2).$exif;
        file_put_contents($chemin, substr($octets, 0, 2).$segment.substr($octets, 2));

        return new UploadedFile($chemin, 'cuisine.jpg', 'image/jpeg', null, true);
    }

    public static function pdf(string $nom = 'piece.pdf'): UploadedFile
    {
        return DocumentsContext::pdf($nom, DocumentsContext::PDF.'%'.bin2hex(random_bytes(8))."\n");
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function devis(object $test, array $scene, string $intervention, int $prix = 20000, array $surcharges = []): TestResponse
    {
        $fichier = self::fichier($test, $scene, $intervention, 'quote');
        self::comme($test, $scene['owner']);

        return $test->postJson(self::url($scene['org'], "/interventions/{$intervention}/quotes"), [
            'reference' => 'DEV-'.bin2hex(random_bytes(3)),
            'kind' => 'initial',
            'issued_on' => '2026-11-17',
            'valid_until' => '2026-12-31',
            'file_id' => $fichier,
            'lines' => [['label' => 'Réparation du siphon', 'quantity_milli' => 1000, 'unit' => 'forfait', 'unit_price' => $prix, 'tax_rate_key' => 'fr_vat_normal']],
            ...$surcharges,
        ]);
    }

    public static function fichier(object $test, array $scene, string $intervention, string $kind): string
    {
        self::comme($test, $scene['owner']);
        $reponse = $test->post(self::url($scene['org'], "/interventions/{$intervention}/files"), ['file' => self::pdf(), 'kind' => $kind], ['Accept' => 'application/json'])->assertCreated();

        return (string) $reponse->json('data.id');
    }

    public static function depositSolde(Organization $org, Lease $bail): int
    {
        return (int) L::dans($org, fn () => app(LedgerReader::class)->depositBalance($bail->id, new Currency('EUR'))->getAmount());
    }

    public static function solde(Organization $org, AccountRole $role): int
    {
        return (int) L::dans($org, fn () => app(LedgerReader::class)->accountBalance($role, new Currency('EUR'))->getAmount());
    }
}
