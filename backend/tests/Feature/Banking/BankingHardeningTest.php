<?php

declare(strict_types=1);

use App\Modules\Banking\Support\Idempotency;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Http\ApiProblem;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Grammars\SQLiteGrammar;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;

/**
 * @return list<string> les requêtes exécutées, un verrou exclusif marqué « for update » et un verrou partagé « share »
 */
function bkTracer(Closure $appel): array
{
    $connexion = DB::connection();
    $ancienne = $connexion->getQueryGrammar();
    $connexion->setQueryGrammar(new class($connexion) extends SQLiteGrammar
    {
        protected function compileLock(Builder $query, $value)
        {
            return $value === true ? ' /* for update */' : ($value === false ? ' /* share */' : '');
        }
    });
    $requetes = [];
    $connexion->listen(function ($requete) use (&$requetes): void {
        $requetes[] = $requete->sql;
    });

    try {
        $appel();
    } finally {
        $connexion->setQueryGrammar($ancienne);
    }

    return $requetes;
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
    $this->titulaire = auth()->user();
});

it('un compte sans droit ne consomme pas le quota horaire d\'import de l\'agence', function (): void {
    $this->actingAs(L::membre($this->org, MemberRole::Manager));
    B::reauthentifier($this);

    foreach (range(1, 30) as $_) {
        B::envoyer($this, 'POST', B::url($this->org, "/accounts/{$this->compte}/statements"), [])->assertForbidden();
    }

    X::changer();
    $this->actingAs($this->titulaire);
    B::reauthentifier($this);

    B::importer($this, $this->org, $this->compte, B::csv([['02/11/2026', 'VIR', '10,00']]))->assertCreated();
});

it('limite à 30 imports par heure et par compte utilisateur', function (): void {
    foreach (range(1, 30) as $_) {
        B::envoyer($this, 'POST', B::url($this->org, "/accounts/{$this->compte}/statements"), [])->assertStatus(422);
    }

    B::envoyer($this, 'POST', B::url($this->org, "/accounts/{$this->compte}/statements"), [])->assertStatus(429);
});

it('limite l\'aperçu à 60 par heure et par compte utilisateur', function (): void {
    $appeler = fn () => $this->post(B::url($this->org, "/accounts/{$this->compte}/statements/preview"), ['file' => UploadedFile::fake()->createWithContent('r.csv', ''), 'format' => 'csv'], ['Accept' => 'application/json']);

    foreach (range(1, 60) as $i) {
        expect($appeler()->getStatusCode())->not->toBe(429);
        $i % 30 === 0 && $this->travel(61)->seconds();
    }

    $appeler()->assertStatus(429);
});

it('ne sert un relevé bancaire que par la route Banking, jamais par le téléchargement générique', function (): void {
    $import = B::importer($this, $this->org, $this->compte, B::csv([['02/11/2026', 'VIR', '10,00']]))->assertCreated();
    $fichier = DB::table('bank_statements')->where('id', $import->json('data.id'))->value('stored_file_id');

    foreach ([MemberRole::Manager, MemberRole::Accountant, MemberRole::Admin] as $role) {
        X::changer();
        $compte = L::membre($this->org, $role);
        activerDeuxFacteurs($compte);
        $this->actingAs($compte);
        B::reauthentifier($this);
        $this->getJson("/api/v1/org/{$this->org->id}/documents/files/{$fichier}/download")->assertNotFound()->assertJsonPath('code', 'file_not_found');
    }

    X::changer();
    $this->actingAs($this->titulaire);
    B::reauthentifier($this);
    $this->getJson("/api/v1/org/{$this->org->id}/documents/files/{$fichier}/download")->assertNotFound();
    $this->getJson(B::url($this->org, "/statements/{$import->json('data.id')}/file"))->assertOk();
});

it('refuse l\'import camt.053 tant que les schémas XSD ne sont pas installés, le CSV restant disponible', function (?string $dossier): void {
    config(['banking.xsd_required' => true, 'banking.xsd_directory' => $dossier]);

    B::importer($this, $this->org, $this->compte, B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']]), 'camt053', nom: 'r.xml')
        ->assertStatus(503)->assertJsonPath('code', 'banking_xsd_unavailable');
    expect(DB::table('bank_statements')->count())->toBe(0);
    B::importer($this, $this->org, $this->compte, B::csv([['02/11/2026', 'VIR', '10,00']]))->assertCreated();
})->with(['dossier non configuré' => [null], 'dossier sans le schéma' => ['/tmp/dossier-banking-vide']]);

it('valide le relevé camt.053 contre le schéma installé, et le refuse s\'il ne le respecte pas', function (): void {
    $dossier = sys_get_temp_dir().'/banking-xsd-'.bin2hex(random_bytes(4));
    mkdir($dossier);
    $schema = static fn (string $racine): string => '<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02" xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02" elementFormDefault="qualified">'.$racine.'</xs:schema>';
    config(['banking.xsd_required' => true, 'banking.xsd_directory' => $dossier]);

    try {
        file_put_contents("{$dossier}/camt.053.001.02.xsd", $schema('<xs:element name="Document" type="xs:anyType"/>'));
        B::importer($this, $this->org, $this->compte, B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']]), 'camt053', nom: 'r.xml')->assertCreated();

        file_put_contents("{$dossier}/camt.053.001.02.xsd", $schema('<xs:element name="Document"><xs:complexType><xs:sequence><xs:element name="Inconnu" type="xs:string"/></xs:sequence></xs:complexType></xs:element>'));
        B::importer($this, $this->org, $this->compte, B::camt([['2026-11-03', 'CRDT', '10.00', 'VIR 2']], ref: 'STMT-2', sequence: '2'), 'camt053', nom: 's.xml')->assertStatus(422)->assertJsonPath('code', 'bank_statement_invalid');
    } finally {
        array_map('unlink', glob("{$dossier}/*") ?: []);
        rmdir($dossier);
    }
});

it('refuse un XML camt.053 dont l\'encodage n\'est pas UTF-8', function (string $contenu): void {
    B::importer($this, $this->org, $this->compte, $contenu, 'camt053', nom: 'r.xml')->assertStatus(422);
    expect(DB::table('bank_statements')->count())->toBe(0);
})->with([
    'ISO-8859-1 déclaré' => fn () => str_replace('encoding="UTF-8"', 'encoding="ISO-8859-1"', B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']])),
    'UTF-7 déclaré avec DOCTYPE encodé' => fn () => '<?xml version="1.0" encoding="UTF-7"?>+ADwAIQ-DOCTYPE d +AFsAPAAh-ENTITY x SYSTEM +ACI-file:///etc/passwd+ACIAPgBd-+AD4-+ADw-Document xmlns=+ACI-urn:iso:std:iso:20022:tech:xsd:camt.053.001.02+ACIAPgAm-x;+ADw-/Document+AD4-',
    'UTF-16 sans déclaration' => fn () => mb_convert_encoding(str_replace('<?xml version="1.0" encoding="UTF-8"?>', '', B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']])), 'UTF-16BE', 'UTF-8'),
    'UTF-16 avec BOM' => fn () => "\xFF\xFE".mb_convert_encoding(B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']]), 'UTF-16LE', 'UTF-8'),
    'octets non UTF-8 sous déclaration UTF-8' => fn () => str_replace('VIR', "V\xE9R", B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']])),
]);

it('refuse d\'accepter une proposition dont la confiance actuelle est devenue faible', function (): void {
    $regle = B::envoyer($this, 'POST', B::url($this->org, '/rules'), ['name' => 'Assurance', 'label_contains' => 'ASSURANCE', 'action' => 'suggest_ignore', 'ignore_reason' => 'out_of_scope', 'confidence' => 'strong'])->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'PRLV ASSURANCE', '-80,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['PRLV ASSURANCE'];
    $proposition = DB::table('bank_suggestions')->where('statement_line_id', $ligne['id'])->first();

    expect($proposition->confidence)->toBe('strong');

    B::envoyer($this, 'PUT', B::url($this->org, '/rules/'.$regle->json('data.id')), ['name' => 'Assurance', 'label_contains' => 'ASSURANCE', 'action' => 'suggest_ignore', 'ignore_reason' => 'out_of_scope', 'confidence' => 'weak', 'active' => true, 'lock_version' => 1])->assertOk();
    DB::table('bank_suggestions')->where('id', $proposition->id)->update(['confidence' => 'strong']);

    $r = B::envoyer($this, 'POST', B::url($this->org, '/suggestions/accept'), ['suggestion_ids' => [$proposition->id]])->assertOk();

    expect($r->json('data.accepted'))->toBe([])->and($r->json('data.skipped.0.reason'))->toBe('bank_line_stale');
    expect(B::lignes($this, $this->org)['PRLV ASSURANCE']['state'])->toBe('unmatched');
});

it('ne journalise ni le titulaire, ni les derniers chiffres, ni le solde d\'ouverture d\'un compte', function (): void {
    $compte = B::compte($this, $this->org, 'trust_bank', B::AUTRE_IBAN, ['holder_name' => 'Titulaire Secret SARL', 'opening_bank_balance' => 123456]);
    B::envoyer($this, 'PATCH', B::url($this->org, "/accounts/{$compte}"), ['label' => 'Compte renommé'])->assertOk();

    $lignes = DB::table('audit_logs')->where('subject_type', 'organization_bank_account')->where('subject_id', $compte)->get();
    $audit = $lignes->map(fn ($l) => json_encode($l))->implode('');

    expect($lignes)->not->toBeEmpty();

    foreach (['Titulaire Secret', '123456', '2606'] as $interdit) {
        expect($audit)->not->toContain($interdit);
    }

    expect($audit)->toContain('holder_name');
});

it('plafonne un montant CSV à 1e14 unités mineures avec une erreur de ligne explicite', function (): void {
    $csv = "Date;Libelle;Montant;Ref\n02/11/2026;PLAFOND;1000000000000,00;R1\n03/11/2026;DEPASSE;1000000000000,01;R2\n04/11/2026;DIX-HUIT;999999999999999999,00;R3\n05/11/2026;DIX-SEPT;999999999999999,00;R4\n";
    $r = B::importer($this, $this->org, $this->compte, $csv)->assertCreated();

    expect($r->json('data.lines_imported'))->toBe(1)->and($r->json('data.lines_rejected'))->toBe(3)
        ->and(array_column($r->json('meta.rejected'), 'code'))->toBe(['amount_invalid', 'amount_invalid', 'amount_invalid']);
    expect(DB::table('bank_statement_lines')->value('amount'))->toBe(100000000000000);
});

it('rend un 409 propre, et non une 500, quand une violation d\'unicité ne vient pas de la clé d\'idempotence', function (): void {
    $idempotence = app(Idempotency::class);
    $avant = DB::table('banking_idempotency_keys')->count();
    $violer = function () use ($idempotence): array {
        $idempotence->remember('cle-a', 'e1', 'bank_statement', (string) Str::uuid());
        $idempotence->remember('cle-a', 'e2', 'bank_statement', (string) Str::uuid());

        return ['type' => 'bank_statement', 'id' => (string) Str::uuid()];
    };

    $erreur = L::dans($this->org, function () use ($idempotence, $violer): ?ApiProblem {
        try {
            $idempotence->run('cle-b', 'e', $violer);
        } catch (ApiProblem $e) {
            return $e;
        }

        return null;
    });

    expect($erreur)->not->toBeNull()->and($erreur->problemCode)->toBe('banking_request_conflict')->and($erreur->status)->toBe(409);
    expect(DB::table('banking_idempotency_keys')->count())->toBe($avant);
});

it('verrouille le compte avant toute lecture de la transaction d\'import', function (): void {
    $requetes = bkTracer(fn () => B::importer($this, $this->org, $this->compte, B::csv([['02/11/2026', 'VIR', '10,00']]))->assertCreated());

    $verrou = collect($requetes)->search(fn (string $sql): bool => str_contains($sql, 'from "organization_bank_accounts"') && str_contains($sql, '/* for update */'));
    $cle = collect($requetes)->search(fn (string $sql): bool => str_contains($sql, 'from "banking_idempotency_keys"'));

    expect($verrou)->not->toBeFalse()->and($cle)->not->toBeFalse()->and($verrou)->toBeLessThan($cle);
});

it('rend 422 pour un curseur de livre de banque invalide et pagine avec un curseur valide', function (): void {
    C::payer($this, $this->org, $this->bail, 30000)->assertCreated();
    C::payer($this, $this->org, $this->bail, 40000)->assertCreated();
    $url = B::url($this->org, "/book-lines?account_id={$this->compte}&limit=1");

    foreach (['abc', rtrim(strtr(base64_encode('pas-un-curseur'), '+/', '-_'), '='), rtrim(strtr(base64_encode('2026-13-45|zzz'), '+/', '-_'), '=')] as $curseur) {
        $this->getJson("{$url}&cursor={$curseur}")->assertStatus(422)->assertJsonPath('code', 'bank_cursor_invalid');
    }

    $page = $this->getJson($url)->assertOk();
    $premiere = $page->json('data.0');
    $valide = rtrim(strtr(base64_encode($premiere['entry_date'].'|'.$premiere['line_id']), '+/', '-_'), '=');
    $apres = $this->getJson("{$url}&cursor={$valide}")->assertOk();

    expect(array_column($apres->json('data'), 'line_id'))->not->toContain($premiere['line_id']);
});
