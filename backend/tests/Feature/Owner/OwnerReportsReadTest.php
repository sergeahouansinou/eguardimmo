<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Arr;
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
    $this->publier = function (array $surcharges = []): string {
        X::agence($this, $this->org);
        $id = RP::rapport($this, $surcharges);
        RP::publier($this, $id)->assertOk();

        return $id;
    };
});

it('ne montre que les comptes rendus publiés : généré et abandonné n\'existent pas pour le mandant', function (): void {
    X::agence($this, $this->org);
    $genere = RP::rapport($this);
    R::lire($this, $this->awa, '/management-reports')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $this->awa, '/management-reports/'.$genere)->assertNotFound()->assertJsonPath('code', 'owner_report_not_found');
    R::lire($this, $this->awa, '/management-reports/'.$genere.'/pdf')->assertNotFound();

    X::agence($this, $this->org);
    RP::publier($this, $genere)->assertOk();
    R::lire($this, $this->awa, '/management-reports')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $genere);
});

it('ne montre pas un compte rendu généré même daté de publication', function (): void {
    X::agence($this, $this->org);
    $genere = RP::rapport($this);
    L::dans($this->org, fn () => DB::table('management_reports')->where('id', $genere)->update(['published_at' => now()->format('Y-m-d H:i:s.u')]));

    R::lire($this, $this->awa, '/management-reports')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $this->awa, '/management-reports/'.$genere)->assertNotFound();
});

it('sert le compte rendu publié avec ses lignes, ses totaux et l\'agence, sans donnée interne', function (): void {
    $id = ($this->publier)();

    $liste = R::lire($this, $this->awa, '/management-reports')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $detail = R::lire($this, $this->awa, '/management-reports/'.$id)->assertOk();
    $texte = R::texte($detail);

    expect($liste->json('data.0'))->toMatchArray(['id' => $id, 'number' => 'CR-2027-0001', 'status' => 'published'])
        ->and($liste->json('data.0'))->not->toHaveKey('lines')
        ->and($detail->json('data.agency'))->toBe(['id' => $this->org->id, 'name' => $this->org->name])
        ->and($detail->json('data.period'))->toMatchArray(['kind' => 'monthly', 'start' => '2026-11-01', 'end' => '2026-11-30'])
        ->and($detail->json('data.totals.collected'))->toBe(['amount' => 70000, 'currency' => 'EUR'])
        ->and($detail->json('data.totals.closing_balance.amount'))->toBe(70000)
        ->and(collect($detail->json('data.lines'))->pluck('kind')->all())->toContain('rent_collected')
        ->and($texte)->not->toContain('idempotency')->and($texte)->not->toContain('fingerprint')->and($texte)->not->toContain('published_by')
        ->and($texte)->not->toContain('source_id')->and($texte)->not->toContain('source_type')->and($texte)->not->toContain('rectification_reason');
});

it('garde lisible le compte rendu remplacé par un rectificatif, avec les deux publiés', function (): void {
    $id = ($this->publier)();
    X::agence($this, $this->org);
    $nouveau = $this->postJson(RP::url($this->org, "/management-reports/{$id}/rectify"), ['reason' => 'Erreur de ventilation des honoraires'])->assertCreated()->json('data.id');
    R::lire($this, $this->awa, '/management-reports')->assertOk()->assertJsonCount(1, 'data');
    X::agence($this, $this->org);
    RP::publier($this, $nouveau)->assertOk();

    $statuts = collect(R::lire($this, $this->awa, '/management-reports')->assertOk()->json('data'))->pluck('status', 'id')->all();

    expect($statuts)->toBe([$nouveau => 'published', $id => 'superseded'])
        ->and(R::lire($this, $this->awa, '/management-reports/'.$id)->assertOk()->json('data.status'))->toBe('superseded');
    R::lire($this, $this->awa, '/management-reports/'.$id.'/pdf')->assertOk();
});

it('télécharge le PDF publié en privé, audité, et refuse celui d\'un autre', function (): void {
    $id = ($this->publier)();
    $bob = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Bob Autre']), 'bob@exemple.fr');

    $pdf = R::lire($this, $this->awa, '/management-reports/'.$id.'/pdf')->assertOk();

    expect($pdf->headers->get('Content-Type'))->toContain('application/pdf')->and($pdf->headers->get('Cache-Control'))->toContain('no-store')
        ->and(L::dans($this->org, fn () => AuditLog::query()->where('action', 'reporting.report.downloaded')->count()))->toBe(1);
    R::lire($this, $bob, '/management-reports/'.$id.'/pdf')->assertNotFound();
    R::lire($this, $this->awa, '/management-reports/'.fake()->uuid().'/pdf')->assertNotFound();
});

it('cloisonne par mandant et par organisation : un autre propriétaire, une copie homonyme dans une autre agence', function (): void {
    $id = ($this->publier)();
    $bob = X::rattacher($this->org, T::partie($this->org, ['display_name' => 'Bob Autre']), 'bob@exemple.fr');
    $autre = T::organisation('Immo Loire');
    $lui = R::proprietaire($autre, 'loire@exemple.fr');
    $copie = Arr::except((array) L::dans($this->org, fn () => DB::table('management_reports')->where('id', $id)->first()), ['open_key', 'rectification_key']);
    $idCopie = fake()->uuid();
    L::dans($autre, fn () => DB::table('management_reports')->insert([...$copie, 'id' => $idCopie, 'organization_id' => $autre->id, 'number' => 'CR-2027-0001', 'supersedes_id' => null, 'stored_file_id' => null, 'issued_document_id' => null]));
    L::dans($autre, fn () => $lui['access']->forceFill(['user_id' => $this->awa->id])->save());

    expect(collect(R::lire($this, $this->awa, '/management-reports')->assertOk()->json('data'))->pluck('id')->all())->toBe([$id]);
    R::lire($this, $this->awa, '/management-reports/'.$idCopie)->assertNotFound();
    R::lire($this, $bob, '/management-reports/'.$id)->assertNotFound();
    R::lire($this, $bob, '/management-reports')->assertOk()->assertJsonCount(0, 'data');
});

it('applique la fenêtre de 12 mois du mandat : lisible pendant la grâce, invisible ensuite', function (): void {
    $id = ($this->publier)();
    $mandat = fn (string $fin) => L::dans($this->org, fn () => DB::table('mandates')->update(['status' => 'terminated', 'ends_on' => $fin]));

    $mandat('2026-06-01');
    R::lire($this, $this->awa, '/management-reports/'.$id)->assertOk();

    $mandat('2025-01-01');
    R::lire($this, $this->awa, '/management-reports')->assertOk()->assertJsonCount(0, 'data');
    R::lire($this, $this->awa, '/management-reports/'.$id)->assertNotFound();
    R::lire($this, $this->awa, '/management-reports/'.$id.'/pdf')->assertNotFound();
});

it('pagine par curseur sans doublon ni saut', function (): void {
    $premier = ($this->publier)();
    X::agence($this, $this->org);
    $second = RP::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);
    RP::publier($this, $second)->assertOk();

    $vus = [];
    $url = '/management-reports?per_page=1';

    do {
        $page = R::lire($this, $this->awa, $url)->assertOk();
        $vus = [...$vus, ...collect($page->json('data'))->pluck('id')->all()];
        $curseur = $page->json('meta.next_cursor');
        $url = '/management-reports?per_page=1&cursor='.$curseur;
    } while ($curseur !== null);

    expect($vus)->toBe([$second, $premier]);
    R::lire($this, $this->awa, '/management-reports?cursor=n-importe-quoi')->assertUnprocessable();
});

it('exige une session et un profil propriétaire pour les comptes rendus', function (): void {
    $id = ($this->publier)();

    foreach (['/management-reports', '/management-reports/'.$id, '/management-reports/'.$id.'/pdf'] as $chemin) {
        O::comme($this, null)->getJson('/api/v1/owner'.$chemin)->assertUnauthorized();
        R::lire($this, User::factory()->create(), $chemin)->assertForbidden();
        R::lire($this, L::titulaire($this->org), $chemin)->assertForbidden();
    }
});

it('lit la liste avec un nombre de requêtes qui ne dépend pas du nombre de comptes rendus', function (): void {
    ($this->publier)();
    $un = R::requetes($this, $this->awa, '/management-reports');
    X::agence($this, $this->org);
    $second = RP::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);
    RP::publier($this, $second)->assertOk();

    expect(R::requetes($this, $this->awa, '/management-reports'))->toBe($un);
});

it('sert le co-indivisaire en lecture seule', function (): void {
    $id = ($this->publier)();
    $co = X::rattacher($this->org, $this->mandant, 'co@exemple.fr', OwnerAccessRole::CoOwner);

    R::lire($this, $co, '/management-reports/'.$id)->assertOk();
});

it('ne journalise aucun téléchargement du PDF quand le contenu du fichier est absent', function (): void {
    $id = ($this->publier)();
    $fichier = L::dans($this->org, fn () => DB::table('stored_files')->where('id', DB::table('management_reports')->where('id', $id)->value('stored_file_id'))->first());
    Storage::disk($fichier->disk)->delete($fichier->path);

    R::lire($this, $this->awa, '/management-reports/'.$id.'/pdf')->assertStatus(500)->assertJsonPath('code', 'file_unavailable');

    expect(L::dans($this->org, fn () => AuditLog::query()->whereIn('action', ['reporting.report.downloaded', 'documents.file.downloaded'])->count()))->toBe(0);
});
