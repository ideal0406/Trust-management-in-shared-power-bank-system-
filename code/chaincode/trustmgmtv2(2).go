package main

import (
    "encoding/json"
    "fmt"
    "strconv"
    "strings"
    "time"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides identity and trust management functions
type SmartContract struct {
    contractapi.Contract
}

// User structure
type User struct {
    DID          string  `json:"did"`
    Name         string  `json:"name"`
    TrustScore   float64 `json:"trustScore"`
    SuccessCount int     `json:"successCount"`
    FailureCount int     `json:"failureCount"`
    CreatedAt    string  `json:"createdAt"`
}

// PowerBank structure
type PowerBank struct {
    DID          string            `json:"did"`
    PublicKey    string            `json:"publicKey"`
    PasswordHash string            `json:"passwordHash"`
    Shares       map[string]string `json:"shares"`
    Owner        string            `json:"owner"`
    Status       string            `json:"status"`
}

// ==================== User Management ====================

// RegisterUser registers a user without certificate verification
func (s *SmartContract) RegisterUser(ctx contractapi.TransactionContextInterface, did, name, initialTrustScoreStr string) error {
    exists, err := s._userExists(ctx, did)
    if err != nil {
        return err
    }
    if exists {
        return fmt.Errorf("User %s already exists", did)
    }

    initialTrustScore, err := strconv.ParseFloat(initialTrustScoreStr, 64)
    if err != nil {
        return fmt.Errorf("Invalid trust score: %s", initialTrustScoreStr)
    }

    timestamp, err := ctx.GetStub().GetTxTimestamp()
    if err != nil {
        return fmt.Errorf("Failed to get timestamp: %v", err)
    }
    createdAt := time.Unix(timestamp.Seconds, int64(timestamp.Nanos)).String()

    user := User{
        DID:          did,
        Name:         name,
        TrustScore:   initialTrustScore,
        SuccessCount: 0,
        FailureCount: 0,
        CreatedAt:    createdAt,
    }

    userJSON, err := json.Marshal(user)
    if err != nil {
        return err
    }
    return ctx.GetStub().PutState(did, userJSON)
}

// UpdateTrustScore updates the user trust score
func (s *SmartContract) UpdateTrustScore(ctx contractapi.TransactionContextInterface, userDID string, newScoreStr string) error {
    newScore, err := strconv.ParseFloat(newScoreStr, 64)
    if err != nil {
        return fmt.Errorf("Invalid score: %s", newScoreStr)
    }

    user, err := s._getUser(ctx, userDID)
    if err != nil {
        return err
    }
    user.TrustScore = newScore

    userJSON, err := json.Marshal(user)
    if err != nil {
        return fmt.Errorf("Failed to serialize user: %v", err)
    }

    err = ctx.GetStub().PutState(userDID, userJSON)
    if err != nil {
        return err
    }

    // Trigger event
    eventPayload := fmt.Sprintf(`{"did":"%s","newScore":%f}`, userDID, newScore)
    ctx.GetStub().SetEvent("ScoreUpdated", []byte(eventPayload))
    return nil
}

// GetTrustScore queries the trust score
func (s *SmartContract) GetTrustScore(ctx contractapi.TransactionContextInterface, userDID string) (float64, error) {
    user, err := s._getUser(ctx, userDID)
    if err != nil {
        return 0, err
    }
    return user.TrustScore, nil
}

// ==================== Power Bank Management ====================

// RegisterPowerBank registers a power bank
func (s *SmartContract) RegisterPowerBank(ctx contractapi.TransactionContextInterface, did, publicKey, passwordHash string) error {
    exists, err := s._powerBankExists(ctx, did)
    if err != nil {
        return err
    }
    if exists {
        return fmt.Errorf("Power bank %s already exists", did)
    }

    pb := PowerBank{
        DID:          did,
        PublicKey:    publicKey,
        PasswordHash: passwordHash,
        Shares:       make(map[string]string),
        Owner:        "",
        Status:       "available",
    }

    pbJSON, err := json.Marshal(pb)
    if err != nil {
        return err
    }
    return ctx.GetStub().PutState(did, pbJSON)
}

// StoreSecretShare stores a secret share
func (s *SmartContract) StoreSecretShare(ctx contractapi.TransactionContextInterface, powerBankDID string, shareIndexStr, encryptedShare string) error {
    pb, err := s._getPowerBank(ctx, powerBankDID)
    if err != nil {
        return err
    }
    if pb.Shares == nil {
        pb.Shares = make(map[string]string)
    }
    pb.Shares[shareIndexStr] = encryptedShare

    pbJSON, err := json.Marshal(pb)
    if err != nil {
        return fmt.Errorf("Failed to serialize power bank: %v", err)
    }
    return ctx.GetStub().PutState(powerBankDID, pbJSON)
}

// GetSecretShares gets all shares
func (s *SmartContract) GetSecretShares(ctx contractapi.TransactionContextInterface, powerBankDID string) (map[string]string, error) {
    pb, err := s._getPowerBank(ctx, powerBankDID)
    if err != nil {
        return nil, err
    }
    return pb.Shares, nil
}

// UpdatePowerBankPasswordHash updates the password hash
func (s *SmartContract) UpdatePowerBankPasswordHash(ctx contractapi.TransactionContextInterface, did, newPasswordHash string) error {
    pb, err := s._getPowerBank(ctx, did)
    if err != nil {
        return err
    }
    pb.PasswordHash = newPasswordHash

    pbJSON, err := json.Marshal(pb)
    if err != nil {
        return fmt.Errorf("Failed to serialize power bank: %v", err)
    }
    return ctx.GetStub().PutState(did, pbJSON)
}

// GetPowerBankPasswordHash gets the password hash
func (s *SmartContract) GetPowerBankPasswordHash(ctx contractapi.TransactionContextInterface, did string) (string, error) {
    pb, err := s._getPowerBank(ctx, did)
    if err != nil {
        return "", err
    }
    return pb.PasswordHash, nil
}

// ==================== System Management ====================

// ClearAllData deletes all key-value pairs starting with "did:", including all user and power bank data
func (s *SmartContract) ClearAllData(ctx contractapi.TransactionContextInterface) error {
    iterator, err := ctx.GetStub().GetStateByRange("", "")
    if err != nil {
        return fmt.Errorf("Failed to get key range: %v", err)
    }
    defer iterator.Close()

    for iterator.HasNext() {
        result, err := iterator.Next()
        if err != nil {
            return fmt.Errorf("Failed to iterate keys: %v", err)
        }
        key := result.Key
        if strings.HasPrefix(key, "did:") {
            if err := ctx.GetStub().DelState(key); err != nil {
                return fmt.Errorf("Failed to delete key %s: %v", key, err)
            }
        }
    }
    return nil
}

// ==================== Internal Helper Functions ====================

func (s *SmartContract) _userExists(ctx contractapi.TransactionContextInterface, did string) (bool, error) {
    userJSON, err := ctx.GetStub().GetState(did)
    if err != nil {
        return false, err
    }
    return userJSON != nil, nil
}

func (s *SmartContract) _getUser(ctx contractapi.TransactionContextInterface, did string) (*User, error) {
    userJSON, err := ctx.GetStub().GetState(did)
    if err != nil {
        return nil, err
    }
    if userJSON == nil {
        return nil, fmt.Errorf("User %s does not exist", did)
    }
    var user User
    err = json.Unmarshal(userJSON, &user)
    return &user, err
}

func (s *SmartContract) _powerBankExists(ctx contractapi.TransactionContextInterface, did string) (bool, error) {
    pbJSON, err := ctx.GetStub().GetState(did)
    if err != nil {
        return false, err
    }
    return pbJSON != nil, nil
}

func (s *SmartContract) _getPowerBank(ctx contractapi.TransactionContextInterface, did string) (*PowerBank, error) {
    pbJSON, err := ctx.GetStub().GetState(did)
    if err != nil {
        return nil, err
    }
    if pbJSON == nil {
        return nil, fmt.Errorf("Power bank %s does not exist", did)
    }
    var pb PowerBank
    err = json.Unmarshal(pbJSON, &pb)
    return &pb, err
}

// ==================== Main Function ====================

func main() {
    chaincode, err := contractapi.NewChaincode(new(SmartContract))
    if err != nil {
        fmt.Printf("Error creating chaincode: %s", err)
        return
    }
    if err := chaincode.Start(); err != nil {
        fmt.Printf("Error starting chaincode: %s", err)
    }
}