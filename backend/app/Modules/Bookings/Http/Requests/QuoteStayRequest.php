<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Requests;

use App\Modules\Bookings\Data\StayRequestData;
use App\Modules\Bookings\Support\StayRules;
use Illuminate\Foundation\Http\FormRequest;

final class QuoteStayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Aucun montant ni statut : le client ne propose que des dates et un nombre de voyageurs.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return StayRules::fields();
    }

    public function toData(string $ref): StayRequestData
    {
        return new StayRequestData($ref, (string) $this->validated('check_in'), (string) $this->validated('check_out'), (int) $this->validated('guests'));
    }
}
