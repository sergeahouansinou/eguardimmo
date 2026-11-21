<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support\Suggestions;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Models\BankCounterpartyLink;
use App\Modules\Banking\Models\BankMatchItem;
use App\Modules\Banking\Models\BankRule;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\Text;
use App\Modules\Invoicing\Data\UnpaidInvoiceData;
use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Rent\Data\UnpaidInstallmentData;
use App\Modules\Rent\PublicApi\RentLedger;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Données lues une fois par compte et par calcul : restes dus (Rent, Invoicing), lignes d'écriture non pointées (Accounting),
 * contreparties connues et règles de l'organisation. Les règles évaluent ensuite en mémoire, sans requête par ligne.
 */
final class SuggestionContext
{
    /** @var list<UnpaidInstallmentData> */
    public array $installments = [];

    /** @var list<UnpaidInvoiceData> */
    public array $invoices = [];

    /** @var array<string, string> numéro d'avis (majuscules) => identifiant d'échéance */
    public array $noticeNumbers = [];

    /** @var array<string, string> identifiant de partie => nom replié */
    public array $partyNames = [];

    /** @var array<string, list<string>> empreinte de contrepartie => identifiants de parties */
    public array $links = [];

    /** @var list<BankBookLineData> */
    public array $bookLines = [];

    /** @var list<BankRule> */
    public array $rules = [];

    public function __construct(
        private readonly RentLedger $loyers,
        private readonly InvoiceLedger $factures,
        private readonly BankBook $banque,
        private readonly PartyDirectory $parties,
    ) {}

    public function load(OrganizationBankAccount $compte, CarbonImmutable $from, CarbonImmutable $to): self
    {
        $this->loadOutstanding($to->addDays(45));
        $this->loadBook($compte, $from->subDays((int) config('banking.match_window_days')), $to->addDays((int) config('banking.match_window_after_days')));
        $this->links = [];

        foreach (BankCounterpartyLink::query()->get() as $lien) {
            $this->links[$lien->counterparty_hash][] = $lien->party_id;
        }

        $this->rules = array_values(BankRule::query()->where('active', true)->orderBy('position')->orderBy('id')->get()->all());

        return $this;
    }

    private function loadOutstanding(CarbonImmutable $asOf): void
    {
        $this->installments = [];
        $apres = null;

        for ($page = 0; $page < 20; $page++) {
            $lot = $this->loyers->unpaidInstallments($asOf, null, $apres, 500);
            array_push($this->installments, ...$lot);

            if (count($lot) < 500) {
                break;
            }

            $apres = $lot[count($lot) - 1]->installmentId;
        }

        $this->invoices = [];
        $apres = null;

        for ($page = 0; $page < 20; $page++) {
            $lot = $this->factures->unpaidByLease($asOf, null, $apres, 500);
            array_push($this->invoices, ...$lot);

            if (count($lot) < 500) {
                break;
            }

            $apres = $lot[count($lot) - 1]->invoiceId;
        }

        $this->noticeNumbers = [];

        foreach (array_chunk(array_map(static fn (UnpaidInstallmentData $i): string => $i->installmentId, $this->installments), 500) as $ids) {
            foreach ($this->loyers->noticesOf($ids) as $avis) {
                $this->noticeNumbers[strtoupper($avis->number)] = $avis->installmentId;
            }
        }

        $partyIds = array_values(array_unique(array_filter([
            ...array_map(static fn (UnpaidInstallmentData $i): ?string => $i->partyId, $this->installments),
            ...array_map(static fn (UnpaidInvoiceData $f): string => $f->partyId, $this->invoices),
        ])));
        $this->partyNames = [];

        foreach (array_chunk($partyIds, 500) as $ids) {
            foreach ($this->parties->findMany($ids) as $id => $partie) {
                if (! $partie->isAnonymized) {
                    $this->partyNames[$id] = Text::fold($partie->displayName);
                }
            }
        }
    }

    private function loadBook(OrganizationBankAccount $compte, CarbonImmutable $from, CarbonImmutable $to): void
    {
        $this->bookLines = [];
        $curseur = null;
        $role = $compte->ledger_role->accountRole();
        $devise = new Currency($compte->currency);
        $max = (int) config('banking.book_window_max');

        do {
            $page = $this->banque->lines($role, $devise, $from, $to, null, null, $curseur, 1000);
            array_push($this->bookLines, ...$page->lines);
            $curseur = $page->nextCursor;
        } while ($curseur !== null && count($this->bookLines) < $max);

        if ($this->bookLines === []) {
            return;
        }

        $pointees = [];

        foreach (array_chunk(array_map(static fn (BankBookLineData $l): string => $l->lineId, $this->bookLines), 500) as $ids) {
            foreach (BankMatchItem::query()->where('side', MatchSide::JournalLine)->whereNull('undone_at')->whereIn('ref_id', $ids)->pluck('ref_id') as $id) {
                $pointees[(string) $id] = true;
            }
        }

        $this->bookLines = array_values(array_filter($this->bookLines, static fn (BankBookLineData $l): bool => ! isset($pointees[$l->lineId])));
    }
}
