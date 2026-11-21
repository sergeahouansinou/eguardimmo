<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Reporting\ReportingContext as RP;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = RP::agence($this);
    $this->awa = X::rattacher($this->org, $this->mandant);
    RP::parcours($this);
    $this->facture = L::dans($this->org, fn () => (array) DB::table('invoices')->where('mandate_id', '!=', null)->first());
    $this->cloner = function (array $surcharges, $org = null): string {
        $org ??= $this->org;
        $copie = [...$this->facture, 'id' => fake()->uuid(), 'organization_id' => $org->id, 'fee_statement_id' => null, 'ledger_entry_id' => null, 'idempotency_key' => fake()->uuid(), ...$surcharges];
        L::dans($org, fn () => DB::table('invoices')->insert($copie));

        return $copie['id'];
    };
});

it('liste et sert la facture d\'honoraires du mandant avec ses lignes et ses taxes', function (): void {
    $liste = R::lire($this, $this->awa, '/invoices')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $detail = R::lire($this, $this->awa, '/invoices/'.$this->facture['id'])->assertOk();
    $texte = R::texte($detail);

    expect($liste->json('data'))->toHaveCount(1)
        ->and($liste->json('data.0'))->toMatchArray(['id' => $this->facture['id'], 'kind' => 'invoice', 'status' => 'paid', 'number' => 'FA-2026-0001', 'has_pdf' => true, 'issued_on' => '2026-12-10'])
        ->and($liste->json('data.0.total_gross'))->toBe(['amount' => 5880, 'currency' => 'EUR'])
        ->and($liste->json('data.0.agency'))->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($liste->json('data.0'))->not->toHaveKey('lines')
        ->and($detail->json('data.lines'))->not->toBeEmpty()->and($detail->json('data.taxes'))->not->toBeEmpty()
        ->and($detail->json('data.total_tax'))->toBe(['amount' => 980, 'currency' => 'EUR'])
        ->and($texte)->not->toContain('fingerprint')->and($texte)->not->toContain('idempotency')->and($texte)->not->toContain('recipient_party_id')
        ->and($texte)->not->toContain('lease_id')->and($texte)->not->toContain('outstanding')->and($texte)->not->toContain('snapshot')
        ->and($texte)->not->toContain('issued_by')->and($texte)->not->toContain('lock_version')->and($texte)->not->toContain('credit_reason');
});

it('télécharge le PDF figé en privé et journalise le téléchargement', function (): void {
    $pdf = R::lire($this, $this->awa, '/invoices/'.$this->facture['id'].'/download')->assertOk();

    expect($pdf->headers->get('Content-Type'))->toContain('application/pdf')->and($pdf->headers->get('Cache-Control'))->toContain('no-store')
        ->and(L::dans($this->org, fn () => AuditLog::query()->where('action', 'invoicing.invoice.downloaded')->count()))->toBe(1);

    $sansPdf = ($this->cloner)(['number' => 'FA-2026-0900', 'stored_file_id' => null, 'issued_document_id' => null]);
    R::lire($this, $this->awa, '/invoices/'.$sansPdf.'/download')->assertStatus(503)->assertJsonPath('code', 'invoice_pdf_unavailable');
});

it('ne montre ni brouillon, ni abandonnée, ni facture reçue comme locataire, ni facture d\'une autre partie', function (): void {
    $brouillon = ($this->cloner)(['status' => 'draft', 'number' => 'FA-2026-0903', 'stored_file_id' => null, 'issued_document_id' => null]);
    $abandonnee = ($this->cloner)(['status' => 'discarded', 'number' => 'FA-2026-0904', 'stored_file_id' => null, 'issued_document_id' => null]);
    $locataire = ($this->cloner)(['mandate_id' => null, 'number' => 'FA-2026-0901']);
    $autrePartie = ($this->cloner)(['recipient_party_id' => T::partie($this->org, ['display_name' => 'Tiers Facture'])->id, 'number' => 'FA-2026-0902']);
    $avoir = ($this->cloner)(['kind' => 'credit_note', 'status' => 'issued', 'number' => 'AF-2026-0001', 'credited_invoice_id' => $this->facture['id']]);

    $ids = collect(R::lire($this, $this->awa, '/invoices')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toContain($this->facture['id'], $avoir)->and($ids)->toHaveCount(2)
        ->and($ids)->not->toContain($brouillon)->not->toContain($abandonnee)->not->toContain($locataire)->not->toContain($autrePartie);

    foreach ([$brouillon, $abandonnee, $locataire, $autrePartie] as $id) {
        R::lire($this, $this->awa, '/invoices/'.$id)->assertNotFound()->assertJsonPath('code', 'owner_invoice_not_found');
        R::lire($this, $this->awa, '/invoices/'.$id.'/download')->assertNotFound();
    }
    expect(R::lire($this, $this->awa, '/invoices/'.$avoir)->assertOk()->json('data'))->toMatchArray(['kind' => 'credit_note', 'credited_invoice_id' => $this->facture['id']]);
});

it('cloisonne par mandant et par organisation : un autre propriétaire, une copie dans une autre agence', function (): void {
    $bob = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Bob Autre']), 'bob@exemple.fr');
    $autre = T::organisation('Immo Loire');
    $lui = R::proprietaire($autre, 'loire@exemple.fr');
    $copie = ($this->cloner)(['number' => 'FA-2026-0001'], $autre);
    L::dans($autre, fn () => $lui['access']->forceFill(['user_id' => $this->awa->id])->save());

    expect(collect(R::lire($this, $this->awa, '/invoices')->assertOk()->json('data'))->pluck('id')->all())->toBe([$this->facture['id']]);
    R::lire($this, $this->awa, '/invoices/'.$copie)->assertNotFound();
    R::lire($this, $this->awa, '/invoices/'.$copie.'/download')->assertNotFound();

    R::lire($this, $bob, '/invoices')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $bob, '/invoices/'.$this->facture['id'])->assertNotFound();
    R::lire($this, $bob, '/invoices/'.$this->facture['id'].'/download')->assertNotFound();
    R::lire($this, $this->awa, '/invoices/'.fake()->uuid())->assertNotFound();
});

it('restreint par ?agency= et refuse une agence hors clé', function (): void {
    R::lire($this, $this->awa, '/invoices?agency='.$this->org->id)->assertOk()->assertJsonCount(1, 'data');
    R::lire($this, $this->awa, '/invoices?agency='.T::organisation('Tiers')->id)->assertNotFound()->assertJsonPath('code', 'owner_agency_not_found');
});

it('pagine par curseur et lit avec un nombre de requêtes constant', function (): void {
    $un = R::requetes($this, $this->awa, '/invoices');

    foreach (range(1, 4) as $i) {
        ($this->cloner)(['number' => 'FA-2026-10'.$i]);
    }

    $vus = [];
    $url = '/invoices?per_page=2';

    do {
        $page = R::lire($this, $this->awa, $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/invoices?per_page=2&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toHaveCount(5)->and(array_unique($vus))->toHaveCount(5)
        ->and(R::requetes($this, $this->awa, '/invoices'))->toBe($un);
    R::lire($this, $this->awa, '/invoices?cursor=n-importe-quoi')->assertUnprocessable();
});

it('exige une session et un profil propriétaire pour les factures', function (): void {
    foreach (['/invoices', '/invoices/'.$this->facture['id'], '/invoices/'.$this->facture['id'].'/download'] as $chemin) {
        O::comme($this, null)->getJson('/api/v1/owner'.$chemin)->assertUnauthorized();
        R::lire($this, User::factory()->create(), $chemin)->assertForbidden();
        R::lire($this, L::titulaire($this->org), $chemin)->assertForbidden();
    }
});

it('ne journalise aucun téléchargement de facture quand le contenu du fichier est absent', function (): void {
    $fichier = L::dans($this->org, fn () => DB::table('stored_files')->where('id', $this->facture['stored_file_id'])->first());
    Storage::disk($fichier->disk)->delete($fichier->path);

    R::lire($this, $this->awa, '/invoices/'.$this->facture['id'].'/download')->assertStatus(500)->assertJsonPath('code', 'file_unavailable');

    expect(L::dans($this->org, fn () => AuditLog::query()->whereIn('action', ['invoicing.invoice.downloaded', 'documents.file.downloaded'])->count()))->toBe(0);
});
