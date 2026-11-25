<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Requests;

use App\Modules\Bookings\Data\StayRequestData;
use App\Modules\Bookings\Support\StayRules;
use Illuminate\Foundation\Http\FormRequest;

final class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Ni `user_id`, ni `organization_id`, ni prix, montants ou statut : le serveur les déduit de l'annonce et du compte authentifié.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return ['listing_ref' => ['required', 'string', 'regex:/^[a-z2-9]{12}$/'], ...StayRules::fields()];
    }

    public function toData(): StayRequestData
    {
        return new StayRequestData((string) $this->validated('listing_ref'), (string) $this->validated('check_in'), (string) $this->validated('check_out'), (int) $this->validated('guests'));
    }
}
